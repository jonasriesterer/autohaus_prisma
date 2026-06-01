from pathlib import Path
import textwrap

base = Path('extras/bruno/autohaus/REST')

# files to update with Autohaus payloads
patches = {
    'Neuanlegen Bearer Token/Neues Buch.yml': 'Neues Autohaus.yml',
    'Neuanlegen OAuth 2/Neues Buch.yml': 'Neues Autohaus.yml',
    'Neuanlegen OAuth 2/Neues Buch mit ungültigen Daten.yml': 'Neues Autohaus mit ungültigen Daten.yml',
    'Neuanlegen OAuth 2/Neues Buch ohne Token.yml': 'Neues Autohaus ohne Token.yml',
    'Neuanlegen OAuth 2 user/Neues Buch als user.yml': 'Neues Autohaus als user.yml',
    'Neuanlegen OAuth 2 Authorization Code/Neues Buch.yml': 'Neues Autohaus.yml',
}

valid_payload = '''{
  "name": "Mein Autohaus",
  "username": "autohaus_user",
  "email": "info@autohaus.de",
  "anzahlFahrzeuge": 12,
  "gruendungsdatum": "2024-05-01",
  "homepage": "https://mein-autohaus.de",
  "telefonnummer": "+49 721 1234567",
  "adresse": {
    "plz": "76131",
    "ort": "Karlsruhe",
    "land": "Deutschland"
  },
  "autos": [
    {
      "kennzeichen": "KA-AB-123",
      "marke": "BMW",
      "modell": "i4",
      "baujahr": 2024
    }
  ]
}'''

invalid_payload = '''{
  "name": "",
  "username": "",
  "email": "not-an-email",
  "anzahlFahrzeuge": -5,
  "gruendungsdatum": "12345-123-123",
  "homepage": "invalid-homepage",
  "telefonnummer": "",
  "adresse": {
    "plz": "761",
    "ort": "",
    "land": ""
  }
}'''

base_payload = r'''info:
  name: {name}
  type: http
  seq: {seq}

http:
  method: POST
  url: "{{restUrl}}"
  headers:
    - name: ""
      value: ""
      disabled: true
  body:
    type: json
    data: |-
      {body}
  auth: inherit

runtime:
  assertions:
    - expression: res.status
      operator: eq
      value: "{status}"
    - expression: res.headers.location
      operator: matches
      value: /rest\/[1-9]\d*$/
    - expression: res.body
      operator: isString
    - expression: res.body
      operator: isEmpty

settings:
  encodeUrl: true
  timeout: 0
  followRedirects: true
  maxRedirects: 5
'''

payloads = {
    'Neuanlegen Bearer Token/Neues Autohaus.yml': {
        'name': 'Neues Autohaus',
        'seq': '1',
        'body': valid_payload,
        'status': '201',
    },
    'Neuanlegen OAuth 2/Neues Autohaus.yml': {
        'name': 'Neues Autohaus',
        'seq': '1',
        'body': valid_payload,
        'status': '201',
    },
    'Neuanlegen OAuth 2/Neues Autohaus ohne Token.yml': {
        'name': 'Neues Autohaus ohne Token',
        'seq': '4',
        'body': valid_payload,
        'status': '401',
    },
    'Neuanlegen OAuth 2 user/Neues Autohaus als user.yml': {
        'name': 'Neues Autohaus als user',
        'seq': '5',
        'body': valid_payload,
        'status': '201',
    },
    'Neuanlegen OAuth 2 Authorization Code/Neues Autohaus.yml': {
        'name': 'Neues Autohaus',
        'seq': '1',
        'body': valid_payload,
        'status': '201',
    },
}

invalid_content_template = '''info:
  name: Neues Autohaus mit ungültigen Daten
  type: http
  seq: 3

http:
  method: POST
  url: "{{restUrl}}"
  headers:
    - name: ""
      value: ""
      disabled: true
  body:
    type: json
    data: |-
      {body}
  auth: inherit

runtime:
  scripts:
    - type: tests
      code: |-
        test('Fehlermeldungen im Response Body', () => {
          const props = ['name', 'username', 'email', 'anzahlFahrzeuge', 'gruendungsdatum', 'homepage', 'telefonnummer', 'adresse'];
          const { detail } = res.getBody();
          expect(detail).to.be.an('array').that.is.not.empty;
          const paths = detail.map(det => det.path);
          paths.forEach(path => {
            expect(path).to.be.an('array').that.is.not.empty;
            expect(path[0]).to.be.a('string').that.includes.oneOf(props);
          });
        });
  assertions:
    - expression: res.status
      operator: eq
      value: "422"
    - expression: res.headers['content-type']
      operator: eq
      value: application/problem+json
    - expression: res.body
      operator: isJson
    - expression: res.body
      operator: isNotEmpty
    - expression: res.body.statusCode
      operator: eq
      value: "422"
    - expression: res.body.title
      operator: eq
      value: Unprocessable Content

settings:
  encodeUrl: true
  timeout: 0
  followRedirects: true
  maxRedirects: 5
'''

invalid_content = invalid_content_template.replace('{body}', invalid_payload)

def indent_payload(payload, indent=6):
    return textwrap.indent(payload, ' ' * indent)

for rel, data in payloads.items():
    path = base / rel
    if not path.exists():
        print('missing', path)
        continue
    content = base_payload.replace('{name}', data['name']).replace('{seq}', data['seq']).replace('{body}', indent_payload(data['body'])).replace('{status}', data['status'])
    path.write_text(content, encoding='utf-8')
    print('patched', path)

invalid_path = base / 'Neuanlegen OAuth 2/Neues Autohaus mit ungültigen Daten.yml'
if invalid_path.exists():
    invalid_content = invalid_content_template.replace('{body}', indent_payload(invalid_payload))
    invalid_path.write_text(invalid_content, encoding='utf-8')
    print('patched', invalid_path)
else:
    print('missing invalid', invalid_path)

# Delete unsupported duplicate-case file
unsupported = base / 'Neuanlegen OAuth 2/Neues Buch mit bereits existierender ISBN.yml'
if unsupported.exists():
    unsupported.unlink()
    print('deleted', unsupported)
else:
    print('no unsupported file to delete', unsupported)
