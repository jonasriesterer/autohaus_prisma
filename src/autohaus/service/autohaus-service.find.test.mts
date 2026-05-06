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

import { PrismaClient } from '@prisma/client/extension';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
    type AutohausMitAdresseUndAutos,
    AutohausService,
} from './autohaus-service.mts';
import { type Pageable } from './pageable.mts';
import { type Suchparameter } from './suchparameter.mts';

// Hoisting: wird an den (Datei-) Anfang verschoben
const { findManyMock, countMock } = vi.hoisted(() => ({
    findManyMock: vi.fn<PrismaClient['autohaus']['findMany']>(),
    countMock: vi.fn<PrismaClient['autohaus']['count']>(),
}));

// vi.mock() bewirkt Hoisting
vi.mock('../../config/prisma-client.mts', () => ({
    prismaClient: {
        autohaus: {
            findMany: findManyMock,
            count: countMock,
        },
    },
}));

describe('AutohausService find', () => {
    let service: AutohausService;

    beforeEach(() => {
        service = new AutohausService();
        findManyMock.mockReset();
        countMock.mockReset();
    });

    test('name vorhanden', async () => {
        // given
        const name = 'Mein Autohaus';
        const suchparameter: Suchparameter = { name };
        const pageable: Pageable = { number: 1, size: 5 };
        const autohausMock: AutohausMitAdresseUndAutos = {
            id: 1,
            version: 0,
            name: 'Mein Autohaus',
            username: 'autohaus_user',
            email: 'info@autohaus.de',
            anzahlFahrzeuge: 42,
            gruendungsdatum: new Date('1990-01-01'),
            homepage: 'https://mein-autohaus.de',
            telefonnummer: '+49 123 456789',
            erzeugt: new Date(),
            aktualisiert: new Date(),
            adresse: {
                id: 11,
                plz: '76131',
                ort: 'Karlsruhe',
                land: 'Deutschland',
                autohausId: 1,
            },
            autos: [],
        };
        // return von prismaClient.autohaus.findMany()
        findManyMock.mockResolvedValueOnce([autohausMock]);
        // return von prismaClient.autohaus.count()
        countMock.mockResolvedValueOnce(1);

        // when
        const result = await service.find(suchparameter, pageable);

        // then
        const { content } = result;

        expect(content).toHaveLength(1);
        expect(content[0]).toStrictEqual(autohausMock);
    });

    test('name nicht vorhanden', async () => {
        // given
        const name = 'Nicht vorhanden';
        const suchparameter: Suchparameter = { name };
        const pageable: Pageable = { number: 1, size: 5 };
        findManyMock.mockResolvedValue([]);

        // when / then
        await expect(service.find(suchparameter, pageable)).rejects.toThrow(
            /^Keine Autohaeuser gefunden/,
        );
    });
});
