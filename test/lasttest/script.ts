// oxlint-disable max-lines
// oxlint-disable func-style
// oxlint-disable no-magic-numbers

import { type Options } from 'k6/options';
// @ts-expect-error https://github.com/grafana/k6-jslib-testing
import { expect } from 'https://jslib.k6.io/k6-testing/0.6.1/index.js';
import { sleep } from 'k6';
import http from 'k6/http';

const baseUrl = 'https://localhost:3000';
// Den Pfad ggf. anpassen, falls der Router unter z.B. /autohaeuser statt /rest gemountet ist
const restUrl = `${baseUrl}/rest`; 
const tokenUrl = `${baseUrl}/auth/token`;
const dbPopulateUrl = `${baseUrl}/dev/db_populate`;

// Beispieldaten, die zu deiner Autohaus-Datenbank passen sollten
const ids = [1, 2, 3, 4, 5]; 
const namenArray = ['Alpha', 'Beta', 'Gamma']; // Beispiel-Namen für Suchparameter
const namenNichtVorhanden = ['XYZ_GibtsNicht', 'QQQ_Unbekannt'];

const tlsDir = '../../src/config/resources/tls';
const cert = open(`${tlsDir}/certificate.crt`);
const key = open(`${tlsDir}/key.pem`);

// Initiales Setup (falls dein System weiterhin Authentifizierung & DB-Reset erfordert)
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
                { target: 15, duration: rampUpDuration },
                { target: 15, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_file: {
            exec: 'getFile',
            executor: 'ramping-vus',
            stages: [
                { target: 5, duration: rampUpDuration },
                { target: 5, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        // Scenarios mit 404 NOT_FOUND -> http_req_failed
        get_name_nicht_vorhanden: {
            exec: 'getByNameNichtVorhanden',
            executor: 'ramping-vus',
            stages: [
                { target: 3, duration: rampUpDuration },
                { target: 3, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
    },
    tlsAuth: [
        {
            cert,
            key,
        },
    ],
    tlsVersion: http.TLS_1_3, 
    insecureSkipTLSVerify: true,
};

// -----------------------------------------------------------------------------
// HTTP-Requests mit Ueberpruefungen (Passend zum autohaus-router.mts)
// -----------------------------------------------------------------------------

// Testet GET /:id
export function getById() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const response = http.get(`${restUrl}/${id}`);

    const { status, headers } = response;
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    sleep(1); 
}

// Testet GET /:id mit ETag (304 Not Modified)
export function getByIdNotModified() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const headers: Record<string, string> = {
        'If-None-Match': '"0"',
    };
    const response = http.get(`${restUrl}/${id}`, { headers });

    // Der Router liefert 304 zurück, wenn die Versionen übereinstimmen
    expect(response.status).toBe(304);
    sleep(1);
}

// Testet GET /?name=<value>
export function getByName() {
    const name = namenArray[Math.floor(Math.random() * namenArray.length)];
    const response = http.get(`${restUrl}?name=${name}`);

    const { status, headers } = response;
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    sleep(1);
}

// Testet GET /file/:id
export function getFile() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const response = http.get(`${restUrl}/file/${id}`);

    // Wir erwarten 200 OK oder 404 Not Found (falls kein File existiert)
    // Damit k6 das nicht zwingend als Fehler wertet, wenn ein Autohaus kein Bild hat, 
    // prüfen wir, ob es einer der beiden erwarteten Statuscodes ist.
    expect([200, 404]).toContain(response.status);
    sleep(1);
}

// Testet 404 bei unbekannten Suchparametern
export function getByNameNichtVorhanden() {
    const name = namenNichtVorhanden[Math.floor(Math.random() * namenNichtVorhanden.length)];
    const response = http.get(`${restUrl}?name=${name}`);

    expect(response.status).toBe(404);
    sleep(1);
}