// lib/countries.ts
// Canonical country names (ISO-ish). Add/remove as needed.
export const COUNTRIES: string[] = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde',
  'Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo (Congo-Brazzaville)',
  'Costa Rica','Côte d’Ivoire','Croatia','Cuba','Cyprus','Czechia','Democratic Republic of the Congo','Denmark','Djibouti','Dominica',
  'Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji',
  'Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala',
  'Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran',
  'Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati',
  'Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania',
  'Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius',
  'Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia',
  'Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
  'Oman','Pakistan','Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe',
  'Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia',
  'South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey',
  'Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu',
  'Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
];

/** Case-insensitive match of user-entered country to our canonical list. */
export function canonicalizeCountry(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  const found = COUNTRIES.find(c => c.toLowerCase() === s);
  if (found) return found;
  // fallback: startsWith match (helps with partials like "united s")
  const starts = COUNTRIES.find(c => c.toLowerCase().startsWith(s));
  return starts ?? input.trim();
}
