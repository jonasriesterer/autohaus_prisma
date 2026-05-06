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
    AutohausMitAdresseUndAutos,
    AutohausService,
} from './autohaus-service.mts';

// Hoisting: wird an den (Datei-) Anfang verschoben
const { findUniqueMock } = vi.hoisted(() => ({
    findUniqueMock: vi.fn<PrismaClient['autohaus']['findUnique']>(),
}));

// vi.mock() bewirkt Hoisting
vi.mock('../../config/prisma-client.mts', () => ({
    prismaClient: {
        autohaus: {
            findUnique: findUniqueMock,
        },
    },
}));

describe('AutohausService findById', () => {
    let service: AutohausService;

    beforeEach(() => {
        service = new AutohausService();
        findUniqueMock.mockReset();
    });

    test('id vorhanden', async () => {
        // given
        const id = 1;
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
        // return von prismaClient.autohaus.findUnique()
        findUniqueMock.mockResolvedValueOnce(autohausMock);

        // when
        const autohaus = await service.findById({ id });

        // then
        expect(autohaus).toStrictEqual(autohausMock);
    });

    test('id nicht vorhanden', async () => {
        // given
        const id = 999;
        findUniqueMock.mockResolvedValue(null);

        // when / then
        await expect(service.findById({ id })).rejects.toThrow(
            `Es gibt kein Autohaus mit der ID ${id}.`,
        );
    });
});
