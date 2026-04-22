-- Copyright (C) 2022 - present Juergen Zimmermann, Hochschule Karlsruhe
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- https://www.postgresql.org/docs/current/manage-ag-tablespaces.html
SET default_tablespace = autohausspace;

-- https://www.postgresql.org/docs/current/sql-createtable.html
-- https://www.postgresql.org/docs/current/datatype.html
CREATE TABLE IF NOT EXISTS autohaus (
    id              INTEGER GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    version         INTEGER NOT NULL DEFAULT 0,
    name            TEXT NOT NULL,
    username        TEXT NOT NULL,
    email           TEXT NOT NULL,
    anzahl_fahrzeuge INTEGER NOT NULL,
    gruendungsdatum DATE NOT NULL,
    homepage        TEXT,
    telefonnummer   TEXT,
    erzeugt         TIMESTAMP NOT NULL DEFAULT NOW(),
    aktualisiert    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- default: btree
CREATE INDEX IF NOT EXISTS autohaus_name_idx ON autohaus(name);

CREATE TABLE IF NOT EXISTS adresse (
    id          INTEGER GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    plz         TEXT NOT NULL CHECK (plz ~ '\d{5}'),
    ort         TEXT NOT NULL,
    land        TEXT NOT NULL,
    autohaus_id INTEGER NOT NULL REFERENCES autohaus ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS adresse_autohaus_id_idx ON adresse(autohaus_id);
CREATE INDEX IF NOT EXISTS adresse_plz_idx ON adresse(plz);

CREATE TABLE IF NOT EXISTS auto (
    id           INTEGER GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    kennzeichen  TEXT NOT NULL,
    marke        TEXT NOT NULL,
    modell       TEXT NOT NULL,
    baujahr      NUMERIC(4,0) NOT NULL,
    autohaus_id  INTEGER NOT NULL REFERENCES autohaus ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS autohaus_file (
    id              integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    data            bytea NOT NULL,
    filename        text NOT NULL,
    mimetype        text,
    autohaus_id     integer NOT NULL UNIQUE REFERENCES autohaus ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS autohaus_file_autohaus_id_idx ON autohaus_file(autohaus_id);

CREATE INDEX IF NOT EXISTS auto_autohaus_id_idx ON auto(autohaus_id);
CREATE INDEX IF NOT EXISTS auto_kennzeichen_idx ON auto(kennzeichen);
