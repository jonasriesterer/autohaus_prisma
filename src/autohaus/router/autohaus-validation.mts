// Copyright (C) 2026 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import { z } from 'zod';

const AdresseSchema = z.strictObject({
    plz: z.string().regex(/^[0-9]{5}$/, 'Ungültige PLZ'),
    ort: z.string().min(1).max(64),
    land: z.string().min(1).max(64),
    autohausId: z.number().int().gt(0),
});

const AutoSchema = z.strictObject({
    kennzeichen: z.string().min(1).max(16),
    marke: z.string().min(1).max(40),
    modell: z.string().min(1).max(40),
    baujahr: z.coerce.number().int().gte(1886).lte(9999),
});

const AutohausComplete = z.strictObject({
    // bei GraphQL ist der Typ ID i.a. ein String
    id: z.union([z.number().int().gt(0), z.string().regex(/^[1-9]\d*$/)]),
    version: z.int().gte(0),
    name: z.string().min(1).max(100),
    username: z.string().min(1).max(50),
    email: z.string().email(),
    anzahlFahrzeuge: z.number().int().gte(0),
    gruendungsdatum: z.coerce.date(),
    homepage: z.httpUrl().optional(),
    telefonnummer: z.string().min(1).max(32).optional(),
    erzeugt: z.coerce.date(),
    aktualisiert: z.coerce.date(),
    adresse: AdresseSchema.optional(),
    autos: z.array(AutoSchema).optional(),
});

export const AutohausNeuSchema = AutohausComplete.omit({
    id: true,
    version: true,
}).readonly();

export const AutohausUpdateSchema = AutohausComplete.omit({
    id: true,
    version: true,
    adresse: true,
    autos: true,
}).readonly();

export const AutohausUpdateGraphQLSchema = AutohausComplete.omit({
    adresse: true,
    autos: true,
}).readonly();

export type AdresseType = z.infer<typeof AdresseSchema>;
export type AutoType = z.infer<typeof AutoSchema>;
export type AutohausNeuType = z.infer<typeof AutohausNeuSchema>;
export type AutohausUpdateType = z.infer<typeof AutohausUpdateSchema>;
