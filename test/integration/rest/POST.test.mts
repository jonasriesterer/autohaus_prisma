// oxlint-disable max-lines-per-function
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

import { beforeAll, describe, expect, test } from 'vitest';
import { type AutohausNeuType } from '../../../src/autohaus/router/autohaus-validation.mts';
import { ProblemDetails } from '../../../src/problem-details.mts';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    LOCATION,
    POST,
    restURL,
} from '../constants.mts';
import { getToken } from '../token.mts';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuesAutohaus: Omit<AutohausNeuType, 'gruendungsdatum'> & {
    gruendungsdatum: string;
} = {
    name: 'Autohaus Test GmbH',
    username: 'test_auto',
    email: 'info@test-autohaus.de',
    anzahlFahrzeuge: 150,
    gruendungsdatum: '2020-01-01',
    homepage: 'https://test-autohaus.de',
    telefonnummer: '0123456789',
    adresse: {
        plz: '12345',
        ort: 'Teststadt',
        land: 'Deutschland',
    },
    autos: [
        {
            kennzeichen: 'KA-TE 123',
            marke: 'Volkswagen',
            modell: 'Golf',
            baujahr: 2022,
        },
    ],
};

const neuesAutohausInvalid: Record<string, unknown> = {
    name: '?!',
    username: 'ab', // Zu kurz
    email: 'falsche-email',
    anzahlFahrzeuge: -10,
    gruendungsdatum: '12345-123-123',
    homepage: 'anyHomepage',
};

const neuesAutohausNameExistiert: Omit<AutohausNeuType, 'gruendungsdatum'> & {
    gruendungsdatum: string;
} = {
    name: 'Zentrum', 
    username: 'zentrum_auto',
    email: 'info@zentrum-autohaus.de',
    anzahlFahrzeuge: 50,
    gruendungsdatum: '2010-05-05',
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('POST /rest', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    test('Neues Autohaus', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutohaus),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(201);

        const responseHeaders = response.headers;
        const location = responseHeaders.get(LOCATION);

        expect(location).toBeDefined();

        // ID nach dem letzten "/"
        const indexLastSlash = location?.lastIndexOf('/') ?? -1;

        expect(indexLastSlash).not.toBe(-1);

        const idStr = location?.slice(indexLastSlash + 1);

        expect(idStr).toBeDefined();
        expect(/^\d+$/.test(idStr ?? '')).toBe(true);
    });

    test('Neues Autohaus mit ungueltigen Daten', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        const expectedPaths = [
            'email',
            'anzahlFahrzeuge',
            'gruendungsdatum',
            'homepage',
        ];

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutohausInvalid),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(422);

        const body = (await response.json()) as ProblemDetails;
        const { detail } = body;

        expect(detail).toBeDefined();
        expect(detail).toHaveLength(expectedPaths.length);

        const paths = detail.map((det: any) => det.path[0]);

        expect(paths).toStrictEqual(expect.arrayContaining(expectedPaths));
    });

    test('Neues Autohaus, aber Name/Email existiert bereits', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutohausNameExistiert),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(500); 
    });

    test.concurrent('Neues Autohaus, aber ohne Token', async () => {
        // when
        const { status } = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutohaus),
        });

        // then
        expect(status).toBe(401);
    });

    test.concurrent('Neues Autohaus, aber mit falschem Token', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

        // when
        const { status } = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutohaus),
            headers,
        });

        // then
        expect(status).toBe(401);
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    test.concurrent.todo('Abgelaufener Token', () => {});
});