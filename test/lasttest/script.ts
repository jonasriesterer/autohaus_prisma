// oxlint-disable max-lines
// oxlint-disable func-style
// oxlint-disable no-magic-numbers
// Copyright (C) 2024 - present Juergen Zimmermann, Hochschule Karlsruhe

import { type Options } from 'k6/options';
// @ts-expect-error https://github.com/grafana/k6-jslib-testing
import { expect } from 'https://jslib.k6.io/k6-testing/0.6.1/index.js';
import { sleep } from 'k6';
import http from 'k6/http';

// HINWEIS: Pfad und Typ-Name an dein aktuelles Projekt anpassen!
// z.B. import { AutohausNeuType } from '../../src/autohaus/router/autohaus-validation.mts';

const baseUrl = 'https://localhost:3000';
const restUrl = `${baseUrl}/rest`;
const graphqlUrl = `${baseUrl}/graphql`;
const tokenUrl = `${baseUrl}/auth/token`;
const dbPopulateUrl = `${baseUrl}/dev/db_populate`;

// Testdaten an das Autohaus-Schema angepasst
const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const namenArray = ['a', 'e', 'i', 'o', 'u'];
const namenNichtVorhanden = ['qqq', 'xxx', 'yyy', 'zzz'];
const emails = [
    'info@autohaus-alpha.de',
    'kontakt@beta-motors.com',
    'service@gamma-auto.de'
];

const neuesAutohaus = {
    name: 'Autohaus k6 Test',
    username: 'test_k6',
    email: 'TBD', // Wird dynamisch generiert
    anzahlFahrzeuge: 42,
    gruendungsdatum: '2020-01-01',
    homepage: 'https://k6-test-autohaus.de',
    telefonnummer: '01234567890',
    adresse: {
        plz: '75223', // Niefern-Öschelbronn
        ort: 'Niefern-Öschelbronn',
        land: 'Deutschland'
    },
    autos: [
        {
            kennzeichen: 'PF-XX 123',
            marke: 'Porsche',
            modell: '911',
            baujahr: 2023
        }
    ]
};

const tlsDir = '../../src/config/resources/tls';
const cert = open(`${tlsDir}/certificate.crt`);
const key = open(`${tlsDir}/key.pem`);

export function setup() {
    const tokenHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = 'username=admin&password=p';
    const tokenResponse = http.post<'text'>(tokenUrl, body, {
        headers: tokenHeaders,
    });
    let token: string;
    if (tokenResponse.status === 200) {
        token = JSON.parse(tokenResponse.body).access_token;
        console.log(`token=${token}`);
    } else {
        throw new Error(
            `setup fuer adminToken: status=${tokenResponse.status}, body=${tokenResponse.body}`,
        );
    }

    const headers = { Authorization: `Bearer ${token}` };
    const res = http.post(dbPopulateUrl, null, { headers });
    if (res.status === 200) {
        console.log('DB neu geladen');
    } else {
        throw new Error(
            `setup fuer db_populate: status=${res.status}, body=${res.body}`,
        );
    }
}

const rampUpDuration = '5s';
const steadyDuration = '22s';
const rampDownDuration = '3s';

export const options: Options = {
    batchPerHost: 50,
    scenarios: {
        get_id: {
            exec: 'getById',
            executor: 'ramping-vus',
            stages: [
                { target: 2, duration: rampUpDuration },
                { target: 2, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_id_not_modified: {
            exec: 'getByIdNotModified',
            executor: 'ramping-vus',
            stages: [
                { target: 5, duration: rampUpDuration },
                { target: 5, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_name: {
            exec: 'getByName',
            executor: 'ramping-vus',
            stages: [
                { target: 20, duration: rampUpDuration },
                { target: 20, duration: '22s' },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_email: {
            exec: 'getByEmail',
            executor: 'ramping-vus',
            stages: [
                { target: 10, duration: rampUpDuration },
                { target: 10, duration: '22s' },
                { target: 0, duration: rampDownDuration },
            ],
        },
        post_autohaus: {
            exec: 'postAutohaus',
            executor: 'ramping-vus',
            stages: [
                { target: 3, duration: rampUpDuration },
                { target: 3, duration: '22s' },
                { target: 0, duration: rampDownDuration },
            ],
        },
        query_autohaus: {
            exec: 'queryAutohaus',
            executor: 'ramping-vus',
            stages: [
                { target: 3, duration: rampUpDuration },
                { target: 3, duration: '22s' },
                { target: 0, duration: rampDownDuration },
            ],
        },
        query_autohaeuser: {
            exec: 'queryAutohaeuser',
            executor: 'ramping-vus',
            stages: [
                { target: 5, duration: rampUpDuration },
                { target: 5, duration: '22s' },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_name_nicht_vorhanden: {
            exec: 'getByNameNichtVorhanden',
            executor: 'ramping-vus',
            stages: [
                { target: 3, duration: rampUpDuration },
                { target: 3, duration: '22s' },
                { target: 0, duration: rampDownDuration },
            ],
        },
    },
    tlsAuth: [ { cert, key } ],
    tlsVersion: http.TLS_1_3,
    insecureSkipTLSVerify: true,
};

// HTTP-Requests mit Ueberpruefungen

export function getById() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const response = http.get(`${restUrl}/${id}`);
    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/json');
    sleep(1);
}

export function getByIdNotModified() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const headers: Record<string, string> = { 'If-None-Match': '"0"' };
    const response = http.get(`${restUrl}/${id}`, { headers });
    expect(response.status).toBe(304);
    sleep(1);
}

export function getByName() {
    const name = namenArray[Math.floor(Math.random() * namenArray.length)];
    const response = http.get(`${restUrl}?name=${name}`);
    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/json');
    sleep(1);
}

export function getByNameNichtVorhanden() {
    const name = namenNichtVorhanden[Math.floor(Math.random() * namenNichtVorhanden.length)];
    const response = http.get(`${restUrl}?name=${name}`);
    expect(response.status).toBe(404);
    sleep(1);
}

export function getByEmail() {
    const email = emails[Math.floor(Math.random() * emails.length)];
    const response = http.get(`${restUrl}?email=${email}`);
    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/json');
    sleep(1);
}

export function postAutohaus() {
    const autohaus = { ...neuesAutohaus };
    // Generiere dynamische E-Mail und Username um Unique-Constraints zu vermeiden
    const randomSuffix = Math.floor(Math.random() * 1000000);
    autohaus.email = `test_${randomSuffix}@k6-loadtest.de`;
    autohaus.username = `k6_user_${randomSuffix}`;

    const tokenHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const body = 'username=admin&password=p';
    const tokenResponse = http.post<'text'>(tokenUrl, body, { headers: tokenHeaders });
    expect(tokenResponse.status).toBe(200);
    const token = JSON.parse(tokenResponse.body).access_token;

    const requestHeaders = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
    const response = http.post(restUrl, JSON.stringify(autohaus), { headers: requestHeaders });

    expect(response.status).toBe(201);
    expect(response.headers['Location']).toContain(restUrl);
    sleep(1);
}

export function queryAutohaus() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const body = {
        query: `
            {
                autohaus(id: "${id}") {
                    version
                    name
                    email
                    anzahlFahrzeuge
                    gruendungsdatum
                    homepage
                    telefonnummer
                    adresse {
                        plz
                        ort
                    }
                }
            }
        `,
    };
    const requestHeaders = { 'Content-Type': 'application/json' };
    const response = http.post(graphqlUrl, JSON.stringify(body), { headers: requestHeaders });

    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/json');
    sleep(1);
}

export function queryAutohaeuser() {
    const name = namenArray[Math.floor(Math.random() * namenArray.length)];
    const body = {
        query: `
            {
                autohaeuser(suchparameter: {
                    name: "${name}"
                }) {
                    name
                    email
                    anzahlFahrzeuge
                }
            }
        `,
    };
    const requestHeaders = { 'Content-Type': 'application/json' };
    const response = http.post(graphqlUrl, JSON.stringify(body), { headers: requestHeaders });

    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/json');
    sleep(1);
}