// Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

/**
 * Das Modul besteht aus der Klasse {@linkcode AutohausWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { prismaClient } from '../../config/prisma-client.mts';
import {
    type AutohausFile,
    type Prisma,
} from '../../generated/prisma/client.ts';
import { getLogger } from '../../logger/logger.mts';
import { sendmail } from '../../mail/sendmail.mts';
import { AutohausService } from './autohaus-service.mts';
import {
    IsbnExistsError,
    NotFoundError,
    VersionInvalidError,
    VersionOutdatedError,
} from './errors.mts';

export type AutohausCreate = Prisma.AutohausCreateInput;
type AutohausCreated = Prisma.AutohausGetPayload<{
    include: {
        adresse: true;
        autos: true;
    };
}>;

export type AutohausUpdate = Prisma.AutohausUpdateInput;
/** Typdefinitionen zum Aktualisieren eines Autohauses mit `update`. */
export type UpdateParams = {
    /** ID des zu aktualisierenden Autohauses. */
    readonly id: number | undefined;
    /** Autohaus-Objekt mit den aktualisierten Werten. */
    readonly autohaus: AutohausUpdate;
    /** Versionsnummer für die zu aktualisierenden Werte. */
    readonly version: string;
};
type AutohausUpdated = Prisma.AutohausGetPayload<{}>;

type AutohausFileCreate = Prisma.AutohausFileUncheckedCreateInput;
export type AutohausFileCreated = Prisma.AutohausFileGetPayload<{}>;

/**
 * Die Klasse `AutohausWriteService` implementiert den Anwendungskern für das
 * Schreiben von Autohäusern und greift mit _Prisma_ auf die DB zu.
 */
export class AutohausWriteService {
    private static readonly VERSION_PATTERN = /^"\d{1,3}"/u;

    readonly #readService: AutohausService;

    readonly #logger = getLogger(AutohausWriteService.name);

    // eslint-disable-next-line max-params
    constructor(readService: AutohausService) {
        this.#readService = readService;
    }

    /**
     * Ein neues Autohaus soll angelegt werden.
     * @param autohaus Das neu abzulegende Autohaus
     * @returns Die ID des neu angelegten Autohauses
     * @throws IsbnExists falls die ISBN-Nummer bereits existiert
     */
    async create(autohaus: AutohausCreate) {
        this.#logger.debug('create: autohaus=%o', autohaus);
        await this.#validateCreate(autohaus);

        // Neuer Datensatz mit generierter ID
        let autohausDb: AutohausCreated | undefined;
        await prismaClient.$transaction(async (tx) => {
            autohausDb = await tx.autohaus.create({
                data: autohaus,
                include: { adresse: true, autos: true },
            });
        });
        await this.#sendmail({
            id: autohausDb?.id ?? 'N/A',
            name: autohausDb?.name ?? 'N/A',
        });

        this.#logger.debug('create: autohausDb.id=%s', autohausDb?.id);
        return autohausDb?.id ?? Number.NaN;
    }

    /**
     * Zu einem vorhandenen Autohaus eine Binärdatei mit z.B. einem Bild abspeichern.
     * @param autohausId ID des vorhandenen Autohauses
     * @param data Bytes der Datei als Buffer Node
     * @param name Dateiname
     * @param size Dateigröße in Bytes
     * @param type MIME-Typ, z.B. image/png
     * @returns Entity-Objekt für `AutohausFile`
     */
    // eslint-disable-next-line max-params
    async addFile(
        autohausId: number,
        data: Buffer,
        name: string,
        size: number,
        type: string,
    ): Promise<Readonly<AutohausFile> | undefined> {
        this.#logger.debug(
            'addFile: autohausId=%d, filename=%s, size=%d',
            autohausId,
            name,
            size,
        );

        // TODO Dateigroesse pruefen

        let autohausFileCreated: AutohausFileCreated | undefined;
        await prismaClient.$transaction(async (tx) => {
            // Autohaus ermitteln, falls vorhanden
            const autohaus = await tx.autohaus.findUnique({
                where: { id: autohausId },
            });
            if (autohaus === null) {
                this.#logger.debug(
                    'Es gibt kein Autohaus mit der ID %d',
                    autohausId,
                );
                throw new NotFoundError(
                    `Es gibt kein Autohaus mit der ID ${autohausId}.`,
                );
            }

            // evtl. vorhandene Datei löschen
            await tx.autohausFile.deleteMany({ where: { autohausId } });

            const autohausFile: AutohausFileCreate = {
                filename: name,
                data: data as Uint8Array<ArrayBuffer>,
                mimetype: type,
                autohausId,
            };
            autohausFileCreated = await tx.autohausFile.create({
                data: autohausFile,
            });
        });

        this.#logger.debug(
            'addFile: id=%s, byteLength=%s, filename=%s, mimetype=%s',
            autohausFileCreated?.id,
            autohausFileCreated?.data.byteLength,
            autohausFileCreated?.filename,
            autohausFileCreated?.mimetype,
        );
        return autohausFileCreated;
    }

    /**
     * Ein vorhandenes Autohaus soll aktualisiert werden. "Destructured" Argument
     * mit id (ID des zu aktualisierenden Autohauses), autohaus (zu aktualisierendes Autohaus)
     * und version (Versionsnummer für optimistische Synchronisation).
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     * @throws NotFoundException falls kein Autohaus zur ID vorhanden ist
     * @throws VersionInvalidException falls die Versionsnummer ungültig ist
     * @throws VersionOutdatedException falls die Versionsnummer veraltet ist
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async update({ id, autohaus, version }: UpdateParams) {
        this.#logger.debug(
            'update: id=%s, autohaus=%o, version=%s',
            id,
            autohaus,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            throw new NotFoundError(`Es gibt kein Autohaus mit der ID ${id}.`);
        }

        await this.#validateUpdate(id, version);

        autohaus.version = { increment: 1 };
        let autohausUpdated: AutohausUpdated | undefined;
        await prismaClient.$transaction(async (tx) => {
            autohausUpdated = await tx.autohaus.update({
                data: autohaus,
                where: { id },
            });
        });
        this.#logger.debug(
            'update: autohausUpdated=%s',
            JSON.stringify(autohausUpdated),
        );

        return autohausUpdated?.version ?? Number.NaN;
    }

    /**
     * Ein Autohaus wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Autohauses
     * @returns true, falls das Autohaus vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);

        const autohaus = await prismaClient.autohaus.findUnique({
            where: { id },
        });
        if (autohaus === null) {
            this.#logger.debug('delete: not found');
            return false;
        }

        await prismaClient.$transaction(async (tx) => {
            await tx.autohaus.delete({ where: { id } });
        });

        this.#logger.debug('delete');
        return true;
    }

    async #validateCreate({
        isbn,
    }: Prisma.AutohausCreateInput): Promise<undefined> {
        this.#logger.debug('#validateCreate: isbn=%s', isbn);
        if (isbn === undefined) {
            this.#logger.debug('#validateCreate: ok');
            return;
        }

        const anzahl = await prismaClient.autohaus.count({ where: { isbn } });
        if (anzahl > 0) {
            this.#logger.debug('#validateCreate: isbn existiert: %s', isbn);
            throw new IsbnExistsError(isbn);
        }
        this.#logger.debug('#validateCreate: ok');
    }

    async #sendmail({ id, name }: { id: number | 'N/A'; name: string }) {
        const subject = `Neues Autohaus ${id}`;
        const body = `Das Autohaus mit dem Namen <strong>${name}</strong> ist angelegt`;
        await sendmail({ subject, body });
    }

    async #validateUpdate(id: number, versionStr: string) {
        this.#logger.debug(
            '#validateUpdate: id=%d, versionStr=%s',
            id,
            versionStr,
        );
        if (!AutohausWriteService.VERSION_PATTERN.test(versionStr)) {
            throw new VersionInvalidError(versionStr);
        }

        const version = Number.parseInt(versionStr.slice(1, -1), 10);
        const autohausDb = await this.#readService.findById({ id });

        if (version < autohausDb.version) {
            this.#logger.debug('#validateUpdate: versionDb=%d', version);
            throw new VersionOutdatedError(version);
        }
    }
}
