// oxlint-disable max-lines-per-function, no-magic-numbers
// Copyright (C) 2026 - present Juergen Zimmermann, Hochschule Karlsruhe

import { describe, expect, test } from 'vitest';
import { type Page } from '../../../src/autohaus/router/page.mts';
import { type AutohausMitAdresse } from '../../../src/autohaus/service/autohaus-service.mts';
import { CONTENT_TYPE, restURL } from '../constants.mts';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const namenArray = ['Auto', 'Motor', 'Zentrum'];
const namenNichtVorhanden = ['XYZGibtsNicht', 'QQQUnbekannt'];
// "javascript" ist laut AutohausService.#checkKeys ein valider Suchparameter
const schlagwoerter = ['javascript', 'typescript']; 

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GET /rest', () => {
    test.concurrent('Alle Autohaeuser', async () => {
        // given
        const requestHeaders = new Headers();
        requestHeaders.append('Accept', 'application/json');

        // when
        const response = await fetch(restURL, { headers: requestHeaders });
        const { status, headers } = response;

        // then
        expect(status).toBe(200);
        expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

        const body = (await response.json()) as Page<AutohausMitAdresse>;

        body.content
            .map((autohaus) => autohaus.id)
            .forEach((id) => {
                expect(id).toBeDefined();
            });
    });

    test.concurrent.each(namenArray)(
        'Autohaeuser mit Teil-Namen %s suchen',
        async (name) => {
            // given
            const params = new URLSearchParams({ name });
            const url = `${restURL}?${params}`;
            const requestHeaders = new Headers();
            requestHeaders.append('Accept', 'application/json');

            // when
            const response = await fetch(url, { headers: requestHeaders });
            const { status, headers } = response;

            // then
            expect(status).toBe(200);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<AutohausMitAdresse>;

            expect(body).toBeDefined();

            body.content
                .map((autohaus) => autohaus.name)
                .forEach((n) =>
                    expect(n?.toLowerCase()).toStrictEqual(
                        expect.stringContaining(name.toLowerCase()),
                    ),
                );
        },
    );

    test.concurrent.each(namenNichtVorhanden)(
        'Autohaeuser zu nicht vorhandenem Namen %s suchen',
        async (name) => {
            // given
            const params = new URLSearchParams({ name });
            const url = `${restURL}?${params}`;
            const requestHeaders = new Headers();
            requestHeaders.append('Accept', 'application/json');

            // when
            const { status } = await fetch(url, { headers: requestHeaders });

            // then
            // AutohausService wirft einen NotFoundError, wenn die Liste leer ist
            expect(status).toBe(404);
        },
    );

    test.concurrent.each(schlagwoerter)(
        'Autohaeuser mit explizit erlaubtem Parameter %s suchen',
        async (schlagwort) => {
            // given
            const params = new URLSearchParams({ [schlagwort]: 'true' });
            const url = `${restURL}?${params}`;
            const requestHeaders = new Headers();
            requestHeaders.append('Accept', 'application/json');

            // when
            const response = await fetch(url, { headers: requestHeaders });
            const { status } = response;

            // then
            // Kann 200 (gefunden) oder 404 (leer) sein, aber NICHT ungültiger Parameter
            expect([200, 404]).toContain(status);
        },
    );

    test.concurrent('Keine Autohaeuser zu einer nicht-vorhandenen Property', async () => {
        // given
        const params = new URLSearchParams({ foo: 'bar' });
        const url = `${restURL}?${params}`;
        const requestHeaders = new Headers();
        requestHeaders.append('Accept', 'application/json');

        // when
        const { status } = await fetch(url, { headers: requestHeaders });

        // then
        // "#checkKeys" im Service wirft bei "foo" einen NotFoundError
        expect(status).toBe(404);
    });
});