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
 * Das Modul besteht aus der Klasse {@linkcode AutohausService}.
 * @packageDocumentation
 */

import { prismaClient } from '../../config/prisma-client.mts';
import { AutohausFile, type Prisma } from '../../generated/prisma/client.ts';
import { type AutohausInclude } from '../../generated/prisma/models/Autohaus.ts';
import { getLogger } from '../../logger/logger.mts';
import { NotFoundError } from './errors.mts';
import { type Pageable } from './pageable.mts';
import { type Slice } from './slice.mts';
import { type Suchparameter, suchparameterNamen } from './suchparameter.mts';
import { buildWhere } from './where-builder.mts';

// Typdefinition für `findById`
type FindByIdParams = {
    // ID des gesuchten Autohauses
    readonly id: number;
    /** Sollen die Autos mitgeladen werden? */
    readonly mitAutos?: boolean;
};

export type AutohausMitAdresse = Prisma.AutohausGetPayload<{
    include: { adresse: true };
}>;

export type AutohausMitAdresseUndAutos = Prisma.AutohausGetPayload<{
    include: {
        adresse: true;
        autos: true;
    };
}>;

/**
 * Die Klasse `AutohausService` implementiert das Lesen für Autohäuser und greift
 * mit _Prisma_ auf eine relationale DB zu.
 */
export class AutohausService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #includeAdresse: AutohausInclude = { adresse: true };
    readonly #includeAdresseUndAutos: AutohausInclude = {
        adresse: true,
        autos: true,
    };

    readonly #logger = getLogger(AutohausService.name);

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C#
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Ein Autohaus asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Autohauses
     * @returns Das gefundene Autohaus in einem Promise aus ES2015.
     * @throws NotFoundError falls kein Autohaus mit der ID existiert
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async findById({
        id,
        mitAutos,
    }: FindByIdParams): Promise<Readonly<AutohausMitAdresseUndAutos>> {
        this.#logger.debug('findById: id=%d', id);

        // Das Resultat ist null, falls kein Datensatz gefunden
        // Lesen: Keine Transaktion erforderlich
        // "include":
        // - referenzierte Daten werden mitgeladen
        // - keine Konfiguration fuer Eager- oder Lazy-Fetching
        // - keine Proxy-Objekte durch evtl. Lazy-Fetching
        // - keine DTO-Klassen mit weggelassenen nicht geladenen Properties
        const include = mitAutos
            ? this.#includeAdresseUndAutos
            : this.#includeAdresse;
        const autohaus: AutohausMitAdresseUndAutos | null =
            await prismaClient.autohaus.findUnique({
                where: { id },
                include,
            });
        if (autohaus === null) {
            this.#logger.debug('Es gibt kein Autohaus mit der ID %d', id);
            throw new NotFoundError(`Es gibt kein Autohaus mit der ID ${id}.`);
        }
        this.#logger.debug('findById: autohaus=%o', autohaus);
        return autohaus;
    }

    /**
     * Binärdatei zu einem Autohaus suchen.
     * @param autohausId ID des zugehörigen Autohauses.
     * @returns Binärdatei oder undefined als Promise.
     */
    async findFileByAutohausId(
        autohausId: number,
    ): Promise<Readonly<AutohausFile> | undefined> {
        this.#logger.debug('findFileByAutohausId: autohausId=%d', autohausId);
        const autohausFile: AutohausFile | null =
            await prismaClient.autohausFile.findUnique({
                where: { autohausId },
            });
        if (autohausFile === null) {
            this.#logger.debug('findFileByAutohausId: Keine Datei gefunden');
            return;
        }

        this.#logger.debug(
            'findFileByAutohausId: id=%s, byteLength=%d, filename=%s, mimetype=%s, autohausId=%d',
            autohausFile.id,
            autohausFile.data.byteLength,
            autohausFile.filename,
            autohausFile.mimetype,
            autohausFile.autohausId,
        );

        // als Datei im Wurzelverzeichnis des Projekts speichern:
        // import { writeFile } from 'node:fs/promises';
        // await writeFile(autohausFile.filename, autohausFile.data);

        return autohausFile;
    }

    /**
     * Bücher asynchron suchen.
     * @param suchparameter JSON-Objekt mit Suchparameter.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns Ein JSON-Array mit den gefundenen Büchern.
     * @throws NotFoundError falls keine Bücher gefunden wurden.
     */
    async find(
        suchparameter: Suchparameter | undefined,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<AutohausMitAdresse>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        // Keine Suchparameter?
        if (suchparameter === undefined) {
            return await this.#findAll(pageable);
        }
        const keys = Object.keys(suchparameter);
        if (keys.length === 0) {
            return await this.#findAll(pageable);
        }

        // Falsche Namen fuer Suchparameter?
        if (!this.#checkKeys(keys) || !this.#checkEnums(suchparameter)) {
            this.#logger.debug('Ungueltige Suchparameter');
            throw new NotFoundError('Ungueltige Suchparameter');
        }

        // Das Resultat ist eine leere Liste, falls nichts gefunden
        // Lesen: Keine Transaktion erforderlich
        const where = buildWhere(suchparameter);
        const { number, size } = pageable;
        const autohaeuser: AutohausMitAdresse[] =
            await prismaClient.autohaus.findMany({
                where,
                skip: number * size,
                take: size,
                include: this.#includeAdresse,
            });
        if (autohaeuser.length === 0) {
            this.#logger.debug('find: Keine Autohaeuser gefunden');
            throw new NotFoundError(
                `Keine Autohaeuser gefunden: ${JSON.stringify(suchparameter)}, Seite ${pageable.number}}`,
            );
        }
        const totalElements = await this.count(where);
        return this.#createSlice(autohaeuser, totalElements);
    }

    /**
     * Anzahl der gefundenen Autohaeuser zurückliefern.
     * @param WHERE-Klausel der eigentlichen Suche.
     * @returns Anzahl der gefundenen Autohaeuser.
     */
    async count(where?: Prisma.AutohausWhereInput) {
        this.#logger.debug('count: where=%o', where ?? 'undefined');
        const { count } = prismaClient.autohaus;
        const anzahl =
            where === undefined ? await count() : await count({ where });
        this.#logger.debug('count: %d', anzahl);
        return anzahl;
    }

    async #findAll(
        pageable: Pageable,
    ): Promise<Readonly<Slice<AutohausMitAdresse>>> {
        const { number, size } = pageable;
        const autohaeuser: AutohausMitAdresse[] =
            await prismaClient.autohaus.findMany({
                skip: number * size,
                take: size,
                include: this.#includeAdresse,
            });
        if (autohaeuser.length === 0) {
            this.#logger.debug('#findAll: Keine Autohaeuser gefunden');
            throw new NotFoundError(`Ungueltige Seite "${number}"`);
        }
        const totalElements = await this.count();
        return this.#createSlice(autohaeuser, totalElements);
    }

    #createSlice(
        autohaeuser: AutohausMitAdresse[],
        totalElements: number,
    ): Readonly<Slice<AutohausMitAdresse>> {
        const autohausSlice: Slice<AutohausMitAdresse> = {
            content: autohaeuser,
            totalElements,
        };
        this.#logger.debug('createSlice: autohausSlice=%o', autohausSlice);
        return autohausSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        // Ist jeder Suchparameter auch eine Property von Autohaus?
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !suchparameterNamen.includes(key) &&
                key !== 'javascript' &&
                key !== 'typescript' &&
                key !== 'java' &&
                key !== 'python'
            ) {
                this.#logger.debug(
                    '#checkKeys: ungueltiger Suchparameter "%s"',
                    key,
                );
                validKeys = false;
            }
        });

        return validKeys;
    }

    #checkEnums(suchparameter: Suchparameter) {
        const { art } = suchparameter;
        this.#logger.debug('#checkEnums: Suchparameter "art=%s"', art);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return (
            art === undefined ||
            art === 'EPUB' ||
            art === 'HARDCOVER' ||
            art === 'PAPERBACK'
        );
    }
}
