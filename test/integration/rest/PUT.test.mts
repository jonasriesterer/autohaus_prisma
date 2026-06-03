// oxlint-disable max-lines-per-function
// Copyright (C) 2025 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { type AutohausUpdateType } from '../../../src/autohaus/router/autohaus-validation.mts';
import { ProblemDetails } from '../../../src/problem-details.mts';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    IF_MATCH,
    PUT,
    restURL,
} from '../constants.mts';
import { getToken } from '../token.mts';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const geaendertesAutohaus: AutohausUpdateType = {
    name: 'Geändertes Autohaus GmbH',
    email: 'neu@autohaus.de',
    anzahlFahrzeuge: 333,
    homepage: 'https://geaendert.autohaus.de',
};

const idVorhanden = '100'; // <- ID auf DB anpassen

const geaendertesAutohausIdNichtVorhanden: AutohausUpdateType = {
    name: 'Nirgendwo Autohaus',
    email: 'gibt@es.nicht',
    anzahlFahrzeuge: 44,
};

const idNichtVorhanden = '999999';

const geaendertesAutohausInvalid: Record<string, unknown> = {
    name: '?!',
    email: 'falsche-email',
    anzahlFahrzeuge: -1,
    homepage: 'anyHomepage',
};

const veraltetesAutohaus: AutohausUpdateType = {
    name: 'Veraltetes Autohaus',
    anzahlFahrzeuge: 1,
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('PUT /rest/:id', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    test('Vorhandenes Autohaus aendern', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAutohaus),
            headers,
        });

        // then
        expect(status).toBe(204);
    });

    test('Nicht-vorhandenes Autohaus aendern', async () => {
        // given
        const url = `${restURL}/${idNichtVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAutohausIdNichtVorhanden),
            headers,
        });

        // then
        expect(status).toBe(404);
    });

    test('Vorhandenes Autohaus aendern, aber mit ungueltigen Daten', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);
        const expectedPaths = [
            'email',
            'anzahlFahrzeuge',
            'homepage',
        ];

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAutohausInvalid),
            headers,
        });

        // then
        expect(response.status).toBe(422);

        const body = (await response.json()) as ProblemDetails;
        const { detail } = body;

        expect(detail).toBeDefined();
        expect(detail).toHaveLength(expectedPaths.length);

        const paths = detail.map((det: any) => det.path[0]);

        expect(paths).toStrictEqual(expect.arrayContaining(expectedPaths));
    });

    test('Vorhandenes Autohaus aendern, aber ohne Versionsnummer', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAutohaus),
            headers,
        });

        // then
        expect(response.status).toBe(428);

        const { detail, statusCode } =
            (await response.json()) as ProblemDetails;

        expect(detail).toContain(IF_MATCH);
        expect(statusCode).toBe(428);
    });

    test('Vorhandenes Autohaus aendern, aber mit alter Versionsnummer', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"-1"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(veraltetesAutohaus),
            headers,
        });

        // then
        expect(response.status).toBe(412);

        const { detail, statusCode } =
            (await response.json()) as ProblemDetails;

        expect(detail).toMatch(/Versionsnummer/u);
        expect(statusCode).toBe(412);
    });

    test('Vorhandenes Autohaus aendern, aber ohne Token', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAutohaus),
            headers,
        });

        // then
        expect(status).toBe(401);
    });

    test('Vorhandenes Autohaus aendern, aber mit falschem Token', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAutohaus),
            headers,
        });

        // then
        expect(status).toBe(401);
    });
});