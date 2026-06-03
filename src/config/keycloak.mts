// Copyright (C) 2024 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul enthält die Konfiguration für _Keycloak_.
 * @packageDocumentation
 */

import { getLogger } from '../logger/logger.mts';
import { config } from './app.mts';
import { env } from './env.mts';

const logger = getLogger('config/keycloak', 'file');

const { keycloak } = config;
const {
    CLIENT_SECRET,
    NODE_ENV,
    KEYCLOAK_HOST,
    KEYCLOAK_PORT,
    KEYCLOAK_SCHEMA,
    KEYCLOAK_ISSUER_HOST,
    KEYCLOAK_ISSUER_PORT,
} = env;

if (keycloak !== undefined && keycloak !== null) {
    if (
        (keycloak.schema !== undefined &&
            typeof keycloak.schema !== 'string') ||
        (keycloak.port !== undefined && typeof keycloak.port !== 'number')
    ) {
        throw new TypeError(
            'Die Konfiguration für Keycloak (Schema und Port) ist falsch',
        );
    }
    if (keycloak.realm !== undefined && typeof keycloak.realm !== 'string') {
        throw new TypeError(
            'Der konfigurierte Realm-Name für Keycloak ist kein String',
        );
    }
    if (
        keycloak.clientId !== undefined &&
        typeof keycloak.clientId !== 'string'
    ) {
        throw new TypeError(
            'Der konfigurierte Client-ID für Keycloak ist kein String',
        );
    }
}

const schema =
    KEYCLOAK_SCHEMA ?? (keycloak?.schema as string | undefined) ?? 'https';
const host =
    KEYCLOAK_HOST ?? (keycloak?.host as string | undefined) ?? 'keycloak';
const portFromEnv =
    KEYCLOAK_PORT === undefined ? undefined : Number(KEYCLOAK_PORT);

if (KEYCLOAK_PORT !== undefined && Number.isNaN(portFromEnv)) {
    throw new TypeError(
        'Die Umgebungsvariable KEYCLOAK_PORT muss eine Zahl sein',
    );
}
const port = portFromEnv ?? (keycloak?.port as number | undefined) ?? 8443;
const authServerUrl = `${schema}://${host}:${port}`;

const issuerHost = KEYCLOAK_ISSUER_HOST ?? host;
const issuerPortFromEnv =
    KEYCLOAK_ISSUER_PORT === undefined
        ? undefined
        : Number(KEYCLOAK_ISSUER_PORT);

if (KEYCLOAK_ISSUER_PORT !== undefined && Number.isNaN(issuerPortFromEnv)) {
    throw new TypeError(
        'Die Umgebungsvariable KEYCLOAK_ISSUER_PORT muss eine Zahl sein',
    );
}
const issuerPort =
    issuerPortFromEnv ?? (keycloak?.port as number | undefined) ?? 8443;
const issuerSchema =
    KEYCLOAK_SCHEMA ?? (keycloak?.schema as string | undefined) ?? 'https';
const issuerAuthServerUrl = `${issuerSchema}://${issuerHost}:${issuerPort}`;

// Keycloak ist in Sicherheits-Bereiche (= realms) unterteilt
const realm = (keycloak?.realm as string | undefined) ?? 'javascript';
const issuer = `${issuerAuthServerUrl}/realms/${realm}`;
const jwksUri = `${authServerUrl}/realms/${realm}/protocol/openid-connect/certs`;
const clientId =
    (keycloak?.clientId as string | undefined) ?? 'javascript-client';
const audience = ['account'];

// fuer KeycloakService
const accessTokenUrl = `${authServerUrl}/realms/${realm}/protocol/openid-connect/token`;

export const keycloakConfig = {
    realm,
    issuer,
    jwksUri,
    clientId,
    audience,
    // fuer KeycloakService
    accessTokenUrl,
    secret:
        CLIENT_SECRET ??
        'ERROR: Umgebungsvariable CLIENT_SECRET nicht gesetzt!',
};

if (NODE_ENV === 'development') {
    logger.debug('keycloakConfig = %o', keycloakConfig);
} else {
    const { secret, ...keycloakConfigLog } = keycloakConfig;
    logger.debug('keycloakConfig = %o', keycloakConfigLog);
}
