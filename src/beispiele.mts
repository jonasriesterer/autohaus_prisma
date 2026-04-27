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

// Aufruf:  bun i
//          bun --env-file=.env prisma generate
//
//          bun --env-file=.env src\beispiele.mts

import { PrismaPg } from '@prisma/adapter-pg';
import { prismaQueryInsights } from '@prisma/sqlcommenter-query-insights';
import process from 'node:process';
import { styleText } from 'node:util';
import {
    PrismaClient,
    type Autohaus,
    type Prisma,
} from './generated/prisma/client.ts';

let message = styleText(['black', 'bgWhite'], 'Node version');
console.log(`${message}=${process.version}`);
message = styleText(['black', 'bgWhite'], 'DATABASE_URL');
console.log(`${message}=${process.env['DATABASE_URL']}`);
console.log();

// "named parameter" durch JSON-Objekt
const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
});

// union type
const log: (Prisma.LogLevel | Prisma.LogDefinition)[] = [
    {
        // siehe unten: prisma.$on('query', ...);
        emit: 'event',
        level: 'query',
    },
    'info',
    'warn',
    'error',
];

// PrismaClient passend zur Umgebungsvariable DATABASE_URL in ".env"
// d.h. mit PostgreSQL-User "autohaus" und Schema "autohaus"
const prisma = new PrismaClient({
    // shorthand property
    adapter,
    errorFormat: 'pretty',
    log,
    // Kommentar zu Log-Ausgabe:
    // /*prismaQuery='Buch.findMany%3A...
    comments: [prismaQueryInsights()],
});
prisma.$on('query', (e) => {
    message = styleText('green', `Query: ${e.query}`);
    console.log(message);
    message = styleText('cyan', `Duration: ${e.duration} ms`);
    console.log(message);
});

export type AutohausMitAdresseUndAutos = Prisma.AutohausGetPayload<{
    include: {
        adresse: true;
        auto: true;
    };
}>;

// Operationen mit dem Model "Autohaus"
try {
    await prisma.$connect();

    // Das Resultat ist null, falls kein Datensatz gefunden
    const autohaus = await prisma.autohaus.findUnique({
        where: { id: 1 },
    });
    message = styleText(['black', 'bgWhite'], 'autohaus');
    console.log(`${message} = %j`, autohaus);
    console.log();

    // SELECT *
    // FROM   autohaus
    // JOIN   adresse ON autohaus.id = adresse.autohaus_id
    // JOIN   auto ON autohaus.id = auto.autohaus_id
    // WHERE  autohaus.name LIKE "%a%"
    const autohaeuser: AutohausMitAdresseUndAutos[] =
        await prisma.autohaus.findMany({
            where: {
                name: {
                    // https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#filter-on-relations
                    // https://www.prisma.io/docs/orm/reference/prisma-client-reference#filter-conditions-and-operators
                    contains: 'a',
                },
            },
            // Fetch-Join mit Adresse und Auto
            include: {
                adresse: true,
                auto: true,
            },
        });
    message = styleText(['black', 'bgWhite'], 'autohaeuser');
    console.log(`${message} = %j`, autohaeuser);
    console.log();

    // union type - Lämder aus den Adressen
    const länder = autohaeuser.map((a) => a.adresse?.land);
    message = styleText(['black', 'bgWhite'], 'länder');
    console.log(`${message} = %j`, länder);
    console.log();

    // Pagination
    const autohaeuser2: Autohaus[] = await prisma.autohaus.findMany({
        skip: 0,
        take: 5,
    });
    message = styleText(['black', 'bgWhite'], 'autohaeuser2');
    console.log(`${message} = %j`, autohaeuser2);
    console.log();
} finally {
    await prisma.$disconnect();
}

// PrismaClient mit PostgreSQL-User "postgres", d.h. mit Administrationsrechten
const adapterAdmin = new PrismaPg({
    connectionString: process.env['DATABASE_URL_ADMIN'],
});
const prismaAdmin = new PrismaClient({ adapter: adapterAdmin });
try {
    const autohaeuserAdmin: Autohaus[] = await prismaAdmin.autohaus.findMany({
        where: {
            name: {
                contains: 'a',
            },
        },
    });
    message = styleText(['black', 'bgWhite'], 'autohaeuserAdmin');
    console.log(`${message} = ${JSON.stringify(autohaeuserAdmin)}`);
} finally {
    await prismaAdmin.$disconnect();
}
