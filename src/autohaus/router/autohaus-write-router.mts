// Copyright (C) 2026 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul besteht aus Router für die Verwaltung von Bücher.
 * @packageDocumentation
 */

import { Hono } from 'hono';
import { File } from 'node:buffer';
import { container } from '../../container.mts';
import { getLogger } from '../../logger/logger.mts';
import {
    badRequest,
    createProblemDetails,
    preconditionRequired,
} from '../../problem-details.mts';
import { rolesRequired } from '../../security/roles-required.mts';
import {
    AutohausCreate,
    AutohausFileCreated,
    AutohausUpdate,
} from '../service/autohaus-write-service.mts';
import {
    AutohausNeuSchema,
    AutohausNeuType,
    AutohausUpdateSchema,
    AutohausUpdateType,
} from './autohaus-validation.mts';
import { createBaseUrl } from './create-base-url.mts';

const { autohausWriteService } = container;

/**
 * Router für die Verwaltung von Bücher.
 * @author [Jürgen Zimmermann](mailto:Juergen.Zimmermann@h-ka.de)
 */
export const router = new Hono();

const logger = getLogger('autohaus-write-router', 'file');

// -----------------------------------------------------------------------------
// N e u a n l e g e n
// -----------------------------------------------------------------------------
router.post('/', rolesRequired('admin', 'user'), async (c) => {
    const requestBody = await c.req.json();

    // Validierung mit Zod: ZodError wird geworfen, falls Validierung nicht erfolgreich
    const autohausDTO: AutohausNeuType = AutohausNeuSchema.parse(requestBody);
    logger.debug('post: autohausDTO=%o', autohausDTO);

    const autohaus = autohausDtoToAutohausCreateInput(autohausDTO);
    const id = await autohausWriteService.create(autohaus);

    const location = `${createBaseUrl(c.req)}/${id}`;
    const { header, body } = c;
    header('Location', location);
    return body(null, 201);
});

const autohausDtoToAutohausCreateInput = (
    autohausDTO: AutohausNeuType,
): AutohausCreate => {
    const autos = autohausDTO.autos?.map(
        (autoDTO: {
            kennzeichen: any;
            marke: any;
            modell: any;
            baujahr: any;
        }) => {
            const auto = {
                kennzeichen: autoDTO.kennzeichen,
                marke: autoDTO.marke,
                modell: autoDTO.modell,
                baujahr: autoDTO.baujahr,
            };
            return auto;
        },
    );
    const autohaus: AutohausCreate = {
        version: 0,
        name: autohausDTO.name,
        username: autohausDTO.username,
        email: autohausDTO.email,
        anzahlFahrzeuge: autohausDTO.anzahlFahrzeuge,
        gruendungsdatum: autohausDTO.gruendungsdatum,
        homepage: autohausDTO.homepage ?? null,
        telefonnummer: autohausDTO.telefonnummer ?? null,
        adresse: {
            create: {
                plz: autohausDTO.adresse?.plz ?? '',
                ort: autohausDTO.adresse?.ort ?? '',
                land: autohausDTO.adresse?.land ?? '',
            },
        },
        autos: { create: autos ?? [] },
    };
    return autohaus;
};

// -----------------------------------------------------------------------------
// A e n d e r n
// -----------------------------------------------------------------------------
router.put('/:id', rolesRequired('admin', 'user'), async (c) => {
    const { req } = c;
    const id = req.param('id') ?? '-1';
    logger.debug('put: id=%s', id);
    const idNumber = Number.parseInt(id, 10);
    if (Number.isNaN(idNumber)) {
        // https://hono.dev/docs/api/context#notfound
        return c.notFound();
    }

    // https://hono.dev/docs/api/request#header
    const version = req.header('If-Match');
    if (version === undefined) {
        logger.debug('put: version === undefined');
        return createProblemDetails(
            c,
            preconditionRequired,
            'Header "If-Match" fehlt',
        );
    }

    const requestBody = await c.req.json();

    // Validierung mit Zod
    const autohausDTO: AutohausUpdateType =
        AutohausUpdateSchema.parse(requestBody);
    logger.debug('put: autohausDTO=%o', autohausDTO);

    const autohaus = autohausDtoToAutohausUpdate(autohausDTO);
    const neueVersion = await autohausWriteService.update({
        id: idNumber,
        autohaus,
        version,
    });
    logger.debug('put: neueVersion=%d', neueVersion);
    const headers = {
        ETag: `"${neueVersion}"`,
    };
    return c.body(null, 204, headers);
});

const autohausDtoToAutohausUpdate = (
    autohausDTO: AutohausUpdateType,
): AutohausUpdate => {
    const autohaus: AutohausUpdate = {
        version: 0,
        ...(autohausDTO.name !== undefined
            ? { name: autohausDTO.name }
            : undefined),
        ...(autohausDTO.username !== undefined
            ? { username: autohausDTO.username }
            : undefined),
        ...(autohausDTO.email !== undefined
            ? { email: autohausDTO.email }
            : undefined),
        ...(autohausDTO.anzahlFahrzeuge !== undefined
            ? { anzahlFahrzeuge: autohausDTO.anzahlFahrzeuge }
            : undefined),
        ...(autohausDTO.gruendungsdatum !== undefined
            ? { gruendungsdatum: autohausDTO.gruendungsdatum }
            : undefined),
        ...(autohausDTO.homepage !== undefined
            ? { homepage: autohausDTO.homepage }
            : undefined),
        ...(autohausDTO.telefonnummer !== undefined
            ? { telefonnummer: autohausDTO.telefonnummer }
            : undefined),
    };
    return autohaus;
};

// -----------------------------------------------------------------------------
// L o e s c h e n
// -----------------------------------------------------------------------------
router.delete('/:id', rolesRequired('admin'), async (c) => {
    const id = c.req.param('id') ?? '-1';
    logger.debug('delete: id=%s', id);
    const idNumber = Number.parseInt(id, 10);
    const { body } = c;
    if (Number.isNaN(idNumber)) {
        return body(null, 204);
    }

    await autohausWriteService.delete(idNumber);
    return body(null, 204);
});

// -----------------------------------------------------------------------------
// F i l e   U p l o a d
// -----------------------------------------------------------------------------
router.post('/:id', rolesRequired('admin', 'user'), async (c) => {
    const id = c.req.param('id') ?? '-1';
    logger.debug('upload: id=%s', id);
    const idNumber = Number.parseInt(id, 10);
    if (Number.isNaN(idNumber)) {
        return c.notFound();
    }

    const contentType = c.req.header('Content-Type');
    logger.debug('upload: contentType=%s', contentType);

    // https://hono.dev/examples/file-upload
    // https://dev.to/aaronksaunders/quick-rest-api-file-upload-with-hono-js-and-drizzle-49ok
    const body = await c.req.parseBody();
    const file = body['file'];
    if (file === undefined || (Array.isArray(file) && file.length !== 1)) {
        return createProblemDetails(
            c,
            badRequest,
            'Keine oder mehrere Dateien hochgeladen',
        );
    }
    if (!(file instanceof File)) {
        return createProblemDetails(
            c,
            badRequest,
            `Ungueltiger Typ beim Upload: ${typeof file}`,
        );
    }

    const { name, size, type } = file;
    logger.debug('upload: name=%s, size=%d, type=%s', name, size, type);
    const buffer = Buffer.from(await file.arrayBuffer());
    const autohausFile: AutohausFileCreated | undefined =
        await autohausWriteService.addFile(idNumber, buffer, name, size, type);
    logger.debug(
        'upload: id=%s, byteLength=%s, filename=%s, mimetype=%s',
        autohausFile?.id,
        autohausFile?.data.byteLength,
        autohausFile?.filename,
        autohausFile?.mimetype,
    );

    const location = `${createBaseUrl(c.req)}/file/${id}`;
    c.header('Location', location);
    return c.body(null, 204);
});
