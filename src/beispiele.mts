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

import process from 'node:process';
import { styleText } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { prismaQueryInsights } from '@prisma/sqlcommenter-query-insights';
import {
    PrismaClient,
    type Buch,
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
// d.h. mit PostgreSQL-User "buch" und Schema "buch"
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

export type BuchMitTitelUndAbbildungen = Prisma.BuchGetPayload<{
    include: {
        titel: true;
        abbildungen: true;
    };
}>;

// Operationen mit dem Model "Buch"
try {
    await prisma.$connect();

    // Das Resultat ist null, falls kein Datensatz gefunden
    const buch: Buch | null = await prisma.buch.findUnique({
        where: { id: 1 },
    });
    message = styleText(['black', 'bgWhite'], 'buch');
    console.log(`${message} = %j`, buch);
    console.log();

    // SELECT *
    // FROM   buch
    // JOIN   titel ON buch.id = titel.buch_id
    // WHERE  titel.titel LIKE "%n%"
    const buecher: BuchMitTitelUndAbbildungen[] = await prisma.buch.findMany({
        where: {
            titel: {
                // https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#filter-on-relations
                titel: {
                    // https://www.prisma.io/docs/orm/reference/prisma-client-reference#filter-conditions-and-operators
                    contains: 'n',
                },
            },
        },
        // Fetch-Join mit Titel und Abbildungen
        include: {
            titel: true,
            abbildungen: true,
        },
    });
    message = styleText(['black', 'bgWhite'], 'buecherMitAbb');
    console.log(`${message} = %j`, buecher);
    console.log();

    // higher-order function und arrow function
    const schlagwoerter = buecher.map((b) => b.schlagwoerter);
    message = styleText(['black', 'bgWhite'], 'schlagwoerter');
    console.log(`${message} = %j`, schlagwoerter);
    console.log();

    // union type
    const titel = buecher.map((b) => b.titel?.titel);
    message = styleText(['black', 'bgWhite'], 'titel');
    console.log(`${message} = %j`, titel);
    console.log();

    // Pagination
    const buecherPage2: Buch[] = await prisma.buch.findMany({
        skip: 5,
        take: 5,
    });
    message = styleText(['black', 'bgWhite'], 'buecherPage2');
    console.log(`${message} = %j`, buecherPage2);
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
    const buecherAdmin: Buch[] = await prismaAdmin.buch.findMany({
        where: {
            titel: {
                titel: {
                    contains: 'n',
                },
            },
        },
    });
    message = styleText(['black', 'bgWhite'], 'buecherAdmin');
    console.log(`${message} = ${JSON.stringify(buecherAdmin)}`);
} finally {
    await prismaAdmin.$disconnect();
}
