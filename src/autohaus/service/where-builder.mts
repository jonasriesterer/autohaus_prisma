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

/**
 * Das Modul besteht aus der Klasse {@linkcode WhereBuilder}.
 * @packageDocumentation
 */

import { Prisma } from '../../generated/prisma/client.ts';
import { type AutohausWhereInput } from '../../generated/prisma/models/Autohaus.ts';
import { getLogger } from '../../logger/logger.mts';
import { type Suchparameter } from './suchparameter.mts';

/** Typdefinitionen für die Suche mit der Autohaus-ID. */
export type BuildIdParams = {
    /** ID des gesuchten Autohauses. */
    readonly id: number;
};

const logger = getLogger('buildWhere', 'func');

/**
 * WHERE-Klausel für die flexible Suche nach Autohäusern bauen.
 * @param suchparameter JSON-Objekt mit Suchparameter. Bei "name" und
 * "username" wird mit einem Teilstring gesucht, bei "anzahlFahrzeuge" mit
 * einem Mindestwert, bei "gruendungsdatum" mit dem frühesten Datum.
 * @returns AutohausWhereInput
 */
// "rest properties" ab ES 2018 https://github.com/tc39/proposal-object-rest-spread
// eslint-disable-next-line max-lines-per-function, prettier/prettier, sonarjs/cognitive-complexity
export const buildWhere = (suchparameter: Suchparameter) => {
    logger.debug('build: suchparameter=%o', suchparameter);

    let where: AutohausWhereInput = {};

    Object.entries(suchparameter).forEach(([key, value]) => {
        switch (key) {
            case 'name':
                where.name = {
                    contains: value as string,
                    mode: Prisma.QueryMode.insensitive,
                };
                break;
            case 'username':
                where.username = {
                    contains: value as string,
                    mode: Prisma.QueryMode.insensitive,
                };
                break;
            case 'email':
                where.email = {
                    contains: value as string,
                    mode: Prisma.QueryMode.insensitive,
                };
                break;
            case 'anzahlFahrzeuge': {
                const anzahl = Number.parseInt(value as string);
                if (!Number.isNaN(anzahl)) {
                    where.anzahlFahrzeuge = { gte: anzahl };
                }
                break;
            }
            case 'gruendungsdatum': {
                const datum = new Date(value as string);
                if (!Number.isNaN(datum.getTime())) {
                    where.gruendungsdatum = { gte: datum };
                }
                break;
            }
            case 'homepage':
                where.homepage = { equals: value as string };
                break;
            case 'telefonnummer':
                where.telefonnummer = { equals: value as string };
                break;
        }
    });

    logger.debug('build: where=%o', where);
    return where;
};
