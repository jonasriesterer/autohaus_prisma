// Copyright (C) 2020 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul enthält Objekte mit Daten aus Umgebungsvariablen.
 * @packageDocumentation
 */

import process from 'node:process';
import { styleText } from 'node:util';

const {
    NODE_ENV: nodeEnv,
    BUN_ENV,
    CLIENT_SECRET,
    KEYCLOAK_HOST,
    KEYCLOAK_PORT,
    KEYCLOAK_SCHEMA,
    KEYCLOAK_ISSUER_HOST,
    KEYCLOAK_ISSUER_PORT,
    LOG_LEVEL,
} = process.env;
const NODE_ENV = nodeEnv ?? BUN_ENV;

// "as const" fuer readonly
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions

export type EnvType = {
    NODE_ENV: string | undefined;
    CLIENT_SECRET: string | undefined;
    KEYCLOAK_HOST: string | undefined;
    KEYCLOAK_PORT: string | undefined;
    KEYCLOAK_SCHEMA: string | undefined;
    KEYCLOAK_ISSUER_HOST: string | undefined;
    KEYCLOAK_ISSUER_PORT: string | undefined;
    LOG_LEVEL: string | undefined;
};

/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Umgebungsvariable zur Konfiguration
 */
export const env: EnvType = {
    // Umgebungsvariable `NODE_ENV` als gleichnamige Konstante, die i.a. einen der
    // folgenden Werte enthält:
    // - `production`, z.B. in einer Cloud,
    // - `development` oder
    // - `test`
    NODE_ENV,
    CLIENT_SECRET,
    KEYCLOAK_HOST,
    KEYCLOAK_PORT,
    KEYCLOAK_SCHEMA,
    KEYCLOAK_ISSUER_HOST,
    KEYCLOAK_ISSUER_PORT,
    LOG_LEVEL,
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

let message = styleText(['black', 'bgWhite'], 'NODE_ENV:');
console.log(`${message} ${NODE_ENV}`);
