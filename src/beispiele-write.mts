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
// along with this program. If not, see <http://www.gnu.org/licenses/>.

// Aufruf:   bun i
//           bun --env-file=.env prisma generate
//
//           bun --env-file=.env src\beispiele-write.mts

import { PrismaPg } from '@prisma/adapter-pg';
import process from 'node:process';
import { styleText } from 'node:util';
import { PrismaClient, type Prisma } from './generated/prisma/client.ts';

let message = styleText(
    'yellow',
    `process.env['DATABASE_URL']=${process.env['DATABASE_URL']}`,
);
console.log(message);
console.log();

const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL_ADMIN'],
});

const log: (Prisma.LogLevel | Prisma.LogDefinition)[] = [
    {
        emit: 'event',
        level: 'query',
    },
    'info',
    'warn',
    'error',
];

// PrismaClient fuer DB "autohaus" (siehe Umgebungsvariable DATABASE_URL in ".env")
// d.h. mit PostgreSQL-User "autohaus" und Schema "autohaus"
const prisma = new PrismaClient({
    adapter,
    errorFormat: 'pretty',
    log,
});
prisma.$on('query', (e) => {
    message = styleText('green', `Query: ${e.query}`);
    console.log(message);
    message = styleText('cyan', `Duration: ${e.duration} ms`);
    console.log(message);
});

const neuesAutohaus: Prisma.AutohausCreateInput = {
    // Spaltentyp "text"
    name: 'Mein Autohaus',
    username: 'autohaus_user',
    email: 'info@autohaus.de',
    // Spaltentyp "integer"
    anzahl_fahrzeuge: 50,
    // Spaltentyp "date"
    gruendungsdatum: '2020-01-15',
    homepage: 'https://mein-autohaus.de',
    telefonnummer: '+49 123 456789',
    // 1:N-Beziehung: Adressen
    adresse: {
        create: [
            {
                plz: '76133',
                ort: 'Karlsruhe',
                land: 'Deutschland',
            },
        ],
    },
    // 1:N-Beziehung: Autos
    auto: {
        create: [
            {
                kennzeichen: 'KA-XX-1001',
                marke: 'BMW',
                modell: '320i',
                baujahr: 2023,
            },
        ],
    },
};
type AutohausCreated = Prisma.AutohausGetPayload<{
    include: {
        adresse: true;
        auto: true;
    };
}>;

const geaenderesAutohaus: Prisma.AutohausUpdateInput = {
    version: { increment: 1 },
    anzahl_fahrzeuge: 75,
    homepage: 'https://mein-autohaus-updated.de',
    telefonnummer: '+49 987 654321',
};
type AutohausUpdated = Prisma.AutohausGetPayload<{}>; // eslint-disable-line @typescript-eslint/no-empty-object-type

// Schreib-Operationen mit dem Model "Autohaus"
try {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => {
        // Neuer Datensatz mit generierter ID
        const autohausDb: AutohausCreated = await tx.autohaus.create({
            data: neuesAutohaus,
            include: { adresse: true, auto: true },
        });
        message = styleText(['black', 'bgWhite'], 'Generierte ID:');
        console.log(`${message} ${autohausDb.id}`);
        console.log();

        // Version +1 wegen "Optimistic Locking" bzw. Vermeidung von "Lost Updates"
        const autohausUpdated: AutohausUpdated = await tx.autohaus.update({
            data: geaenderesAutohaus,
            where: { id: 1 },
        });
        // eslint-disable-next-line require-atomic-updates
        message = styleText(['black', 'bgWhite'], 'Aktualisierte Version:');
        console.log(`${message} ${autohausUpdated.version}`);
        console.log();

        // https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions#referential-action-defaults
        // https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/relation-mode
        const geloescht = await tx.autohaus.delete({ where: { id: 2 } });
        // eslint-disable-next-line require-atomic-updates
        message = styleText(['black', 'bgWhite'], 'Geloescht:');
        console.log(`${message} ${geloescht.id}`);
    });
} finally {
    await prisma.$disconnect();
}
