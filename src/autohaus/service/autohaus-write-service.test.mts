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

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.ts';
import { AutohausService } from './autohaus-service.mts';
import {
    AutohausCreate,
    AutohausWriteService,
} from './autohaus-write-service.mts';

// Hoisting: wird an den (Datei-) Anfang verschoben
const { createMock, countMock, transactionMock, sendmailMock } = vi.hoisted(
    () => ({
        createMock: vi.fn<Prisma.AutohausDelegate['create']>(),
        countMock: vi.fn<Prisma.AutohausDelegate['count']>(),
        transactionMock: vi.fn(), // eslint-disable-line vitest/require-mock-type-parameters
        sendmailMock: vi.fn(),
    }),
);

// vi.mock() bewirkt Hoisting
vi.mock('../../config/prisma-client.mts', () => ({
    prismaClient: {
        autohaus: {
            create: createMock,
            count: countMock,
        },
        $transaction: transactionMock,
    },
}));

vi.mock('../../mail/sendmail.mts', () => ({
    sendmail: sendmailMock,
}));

describe('AutohausWriteService create', () => {
    let service: AutohausWriteService;
    let readService: AutohausService;

    beforeEach(() => {
        readService = new AutohausService();
        service = new AutohausWriteService(readService);

        createMock.mockReset();
        countMock.mockReset();
        transactionMock.mockReset();
        sendmailMock.mockReset();

        transactionMock.mockImplementation(async (callback: any) => {
            return callback({
                autohaus: {
                    create: createMock,
                    count: countMock,
                },
            });
        });
    });

    test('Neues Autohaus', async () => {
        // given
        const idMock = 1;
        const autohaus: AutohausCreate = {
            name: 'Autohaus Name',
            username: 'username',
            email: 'email@example.com',
            anzahlFahrzeuge: 10,
            gruendungsdatum: new Date(),
            adresse: {
                create: {
                    plz: 'PLZ',
                    ort: 'Ort',
                    land: 'Deutschland',
                },
            },
        };
        const autohausTmp: any = { ...autohaus };
        autohausTmp.id = idMock;
        autohausTmp.adresse.create.autohausId = idMock;
        // return von tx.autohaus.create()
        createMock.mockResolvedValue(autohausTmp);
        // sendmail ist eine void-Funktion
        sendmailMock.mockResolvedValue(undefined);

        // when
        const id = await service.create(autohaus);

        // then
        expect(id).toBe(idMock);
        expect(sendmailMock).toHaveBeenCalledTimes(1);
    });
});
