import type { Distrito, Regiao } from '@/types'

export interface Localidade {
  /** nome apresentado (pode incluir zona: "Lisboa — Alvalade") */
  nome: string
  /** nome curto da localidade */
  localidade: string
  concelho: string
  distrito: Distrito
  regiao: Regiao
  lat: number
  lng: number
  /** nº de instituições de demonstração a gerar */
  n: number
  /** prefixo do código postal */
  cp: string
  /** indicativo telefónico */
  ind: string
  /** direção do mar/rio, para afastar os marcadores da água */
  agua?: 'N' | 'S' | 'E' | 'W' | 'NW' | 'SW' | 'SE'
  /** fator de preço regional (privados) */
  preco: number
  /** sufixo regional para nomes ("do Douro") */
  sufixo?: string
}

const L = (
  nome: string,
  concelho: string,
  distrito: Distrito,
  regiao: Regiao,
  lat: number,
  lng: number,
  n: number,
  cp: string,
  ind: string,
  preco: number,
  extra: Partial<Pick<Localidade, 'agua' | 'sufixo' | 'localidade'>> = {},
): Localidade => ({
  nome,
  localidade: extra.localidade ?? nome.split(' — ')[0]!,
  concelho,
  distrito,
  regiao,
  lat,
  lng,
  n,
  cp,
  ind,
  preco,
  agua: extra.agua,
  sufixo: extra.sufixo,
})

/** Localidades com coordenadas reais (centro aproximado, ligeiramente para o interior nas zonas costeiras). */
export const LOCALIDADES: Localidade[] = [
  // Porto
  L('Porto — Boavista', 'Porto', 'Porto', 'Norte', 41.16, -8.632, 3, '4100', '22', 1.12, { sufixo: 'do Douro' }),
  L('Porto — Paranhos', 'Porto', 'Porto', 'Norte', 41.172, -8.601, 3, '4200', '22', 1.1, { sufixo: 'do Douro' }),
  L('Porto — Bonfim', 'Porto', 'Porto', 'Norte', 41.148, -8.595, 2, '4300', '22', 1.08, { agua: 'S', sufixo: 'do Douro' }),
  L('Porto — Foz do Douro', 'Porto', 'Porto', 'Norte', 41.1555, -8.668, 2, '4150', '22', 1.2, { agua: 'SW', sufixo: 'da Foz' }),
  L('Matosinhos', 'Matosinhos', 'Porto', 'Norte', 41.184, -8.688, 3, '4450', '22', 1.08, { agua: 'W', sufixo: 'Atlântico' }),
  L('Vila Nova de Gaia', 'Vila Nova de Gaia', 'Porto', 'Norte', 41.129, -8.606, 3, '4400', '22', 1.05, { agua: 'N', sufixo: 'do Douro' }),
  L('Maia', 'Maia', 'Porto', 'Norte', 41.2357, -8.6199, 2, '4470', '22', 1.0),
  L('Gondomar', 'Gondomar', 'Porto', 'Norte', 41.1449, -8.5323, 2, '4420', '22', 0.98),
  L('Valongo', 'Valongo', 'Porto', 'Norte', 41.1887, -8.4986, 1, '4440', '22', 0.95),
  L('Póvoa de Varzim', 'Póvoa de Varzim', 'Porto', 'Norte', 41.383, -8.755, 1, '4490', '252', 1.0, { agua: 'W' }),
  L('Vila do Conde', 'Vila do Conde', 'Porto', 'Norte', 41.3536, -8.74, 1, '4480', '252', 1.0, { agua: 'W' }),
  L('Santo Tirso', 'Santo Tirso', 'Porto', 'Norte', 41.3426, -8.4775, 1, '4780', '252', 0.92),
  L('Paredes', 'Paredes', 'Porto', 'Norte', 41.205, -8.3307, 1, '4580', '255', 0.88),
  L('Penafiel', 'Penafiel', 'Porto', 'Norte', 41.2083, -8.2833, 1, '4560', '255', 0.88),
  L('Amarante', 'Amarante', 'Porto', 'Norte', 41.2717, -8.075, 1, '4600', '255', 0.88, { sufixo: 'do Tâmega' }),
  // Braga
  L('Braga', 'Braga', 'Braga', 'Norte', 41.5454, -8.4265, 4, '4700', '253', 0.98, { sufixo: 'do Minho' }),
  L('Guimarães', 'Guimarães', 'Braga', 'Norte', 41.4425, -8.2918, 3, '4800', '253', 0.95),
  L('Barcelos', 'Barcelos', 'Braga', 'Norte', 41.5388, -8.6151, 2, '4750', '253', 0.9, { sufixo: 'do Cávado' }),
  L('Vila Nova de Famalicão', 'Vila Nova de Famalicão', 'Braga', 'Norte', 41.408, -8.5198, 2, '4760', '252', 0.92),
  L('Fafe', 'Fafe', 'Braga', 'Norte', 41.45, -8.1667, 1, '4820', '253', 0.85),
  // Viana do Castelo
  L('Viana do Castelo', 'Viana do Castelo', 'Viana do Castelo', 'Norte', 41.696, -8.825, 2, '4900', '258', 0.92, { agua: 'SW', sufixo: 'do Lima' }),
  L('Ponte de Lima', 'Ponte de Lima', 'Viana do Castelo', 'Norte', 41.7672, -8.5836, 1, '4990', '258', 0.88, { sufixo: 'do Lima' }),
  // Vila Real
  L('Vila Real', 'Vila Real', 'Vila Real', 'Norte', 41.3006, -7.7441, 2, '5000', '259', 0.85, { sufixo: 'do Marão' }),
  L('Chaves', 'Chaves', 'Vila Real', 'Norte', 41.74, -7.47, 1, '5400', '276', 0.82),
  L('Peso da Régua', 'Peso da Régua', 'Vila Real', 'Norte', 41.165, -7.788, 1, '5050', '254', 0.82, { agua: 'S', sufixo: 'do Douro' }),
  // Bragança
  L('Bragança', 'Bragança', 'Bragança', 'Norte', 41.8058, -6.7572, 1, '5300', '273', 0.8, { sufixo: 'Transmontano' }),
  L('Mirandela', 'Mirandela', 'Bragança', 'Norte', 41.485, -7.1817, 1, '5370', '278', 0.8, { sufixo: 'do Tua' }),
  // Viseu
  L('Viseu', 'Viseu', 'Viseu', 'Centro', 40.6566, -7.9125, 3, '3500', '232', 0.88, { sufixo: 'do Dão' }),
  L('Lamego', 'Lamego', 'Viseu', 'Norte', 41.0971, -7.8097, 1, '5100', '254', 0.82),
  // Aveiro
  L('Aveiro', 'Aveiro', 'Aveiro', 'Centro', 40.638, -8.645, 2, '3810', '234', 0.98, { agua: 'W', sufixo: 'da Ria' }),
  L('Águeda', 'Águeda', 'Aveiro', 'Centro', 40.5744, -8.4481, 1, '3750', '234', 0.88),
  L('Ovar', 'Ovar', 'Aveiro', 'Centro', 40.8596, -8.6253, 1, '3880', '256', 0.9),
  L('Santa Maria da Feira', 'Santa Maria da Feira', 'Aveiro', 'Norte', 40.9255, -8.5426, 2, '4520', '256', 0.92),
  L('Oliveira de Azeméis', 'Oliveira de Azeméis', 'Aveiro', 'Norte', 40.8417, -8.4769, 1, '3720', '256', 0.88),
  L('Espinho', 'Espinho', 'Aveiro', 'Norte', 41.0072, -8.638, 1, '4500', '22', 1.0, { agua: 'W' }),
  // Coimbra
  L('Coimbra — Celas', 'Coimbra', 'Coimbra', 'Centro', 40.215, -8.415, 3, '3000', '239', 0.95, { sufixo: 'do Mondego' }),
  L('Coimbra — Santa Clara', 'Coimbra', 'Coimbra', 'Centro', 40.198, -8.44, 1, '3040', '239', 0.92, { agua: 'E', sufixo: 'do Mondego' }),
  L('Figueira da Foz', 'Figueira da Foz', 'Coimbra', 'Centro', 40.153, -8.855, 1, '3080', '233', 0.92, { agua: 'SW' }),
  L('Cantanhede', 'Cantanhede', 'Coimbra', 'Centro', 40.3467, -8.5944, 1, '3060', '231', 0.85),
  L('Lousã', 'Lousã', 'Coimbra', 'Centro', 40.1125, -8.2467, 1, '3200', '239', 0.85, { sufixo: 'da Serra' }),
  // Leiria
  L('Leiria', 'Leiria', 'Leiria', 'Centro', 39.7436, -8.8071, 2, '2400', '244', 0.92, { sufixo: 'do Lis' }),
  L('Marinha Grande', 'Marinha Grande', 'Leiria', 'Centro', 39.7473, -8.9321, 1, '2430', '244', 0.88, { sufixo: 'do Pinhal' }),
  L('Pombal', 'Pombal', 'Leiria', 'Centro', 39.9167, -8.6333, 1, '3100', '236', 0.85),
  L('Caldas da Rainha', 'Caldas da Rainha', 'Leiria', 'Centro', 39.4036, -9.1386, 2, '2500', '262', 0.95, { sufixo: 'do Oeste' }),
  L('Alcobaça', 'Alcobaça', 'Leiria', 'Centro', 39.5521, -8.9773, 1, '2460', '262', 0.88),
  // Santarém
  L('Santarém', 'Santarém', 'Santarém', 'Lisboa e Vale do Tejo', 39.2369, -8.685, 2, '2000', '243', 0.88, { sufixo: 'do Ribatejo' }),
  L('Tomar', 'Tomar', 'Santarém', 'Centro', 39.602, -8.411, 1, '2300', '249', 0.85, { sufixo: 'do Nabão' }),
  L('Ourém', 'Ourém', 'Santarém', 'Centro', 39.656, -8.58, 1, '2490', '249', 0.85),
  L('Torres Novas', 'Torres Novas', 'Santarém', 'Centro', 39.48, -8.54, 1, '2350', '249', 0.85),
  L('Abrantes', 'Abrantes', 'Santarém', 'Centro', 39.4667, -8.197, 1, '2200', '241', 0.82, { sufixo: 'do Tejo' }),
  L('Almeirim', 'Almeirim', 'Santarém', 'Lisboa e Vale do Tejo', 39.21, -8.63, 1, '2080', '243', 0.85, { sufixo: 'do Ribatejo' }),
  // Castelo Branco / Guarda
  L('Castelo Branco', 'Castelo Branco', 'Castelo Branco', 'Centro', 39.8222, -7.4909, 2, '6000', '272', 0.8, { sufixo: 'da Beira' }),
  L('Covilhã', 'Covilhã', 'Castelo Branco', 'Centro', 40.2806, -7.5044, 1, '6200', '275', 0.8, { sufixo: 'da Estrela' }),
  L('Guarda', 'Guarda', 'Guarda', 'Centro', 40.5373, -7.2676, 1, '6300', '271', 0.78, { sufixo: 'da Serra' }),
  L('Seia', 'Seia', 'Guarda', 'Centro', 40.42, -7.7, 1, '6270', '238', 0.78, { sufixo: 'da Estrela' }),
  // Lisboa
  L('Lisboa — Campo de Ourique', 'Lisboa', 'Lisboa', 'Lisboa e Vale do Tejo', 38.718, -9.164, 2, '1350', '21', 1.3, { sufixo: 'de Lisboa' }),
  L('Lisboa — Alvalade', 'Lisboa', 'Lisboa', 'Lisboa e Vale do Tejo', 38.75, -9.14, 3, '1700', '21', 1.28),
  L('Lisboa — Benfica', 'Lisboa', 'Lisboa', 'Lisboa e Vale do Tejo', 38.751, -9.201, 2, '1500', '21', 1.2),
  L('Lisboa — Lumiar', 'Lisboa', 'Lisboa', 'Lisboa e Vale do Tejo', 38.77, -9.16, 2, '1600', '21', 1.22),
  L('Lisboa — Estrela', 'Lisboa', 'Lisboa', 'Lisboa e Vale do Tejo', 38.714, -9.16, 1, '1200', '21', 1.32, { agua: 'S', sufixo: 'do Tejo' }),
  L('Lisboa — Areeiro', 'Lisboa', 'Lisboa', 'Lisboa e Vale do Tejo', 38.742, -9.134, 2, '1000', '21', 1.28),
  L('Lisboa — Parque das Nações', 'Lisboa', 'Lisboa', 'Lisboa e Vale do Tejo', 38.768, -9.1, 1, '1990', '21', 1.35, { agua: 'E', sufixo: 'do Tejo' }),
  L('Lisboa — Belém', 'Lisboa', 'Lisboa', 'Lisboa e Vale do Tejo', 38.702, -9.203, 1, '1400', '21', 1.3, { agua: 'S', sufixo: 'do Tejo' }),
  L('Oeiras', 'Oeiras', 'Lisboa', 'Lisboa e Vale do Tejo', 38.705, -9.305, 2, '2780', '21', 1.22, { agua: 'S' }),
  L('Cascais', 'Cascais', 'Lisboa', 'Lisboa e Vale do Tejo', 38.705, -9.415, 2, '2750', '21', 1.3, { agua: 'S', sufixo: 'Atlântico' }),
  L('Estoril', 'Cascais', 'Lisboa', 'Lisboa e Vale do Tejo', 38.711, -9.395, 1, '2765', '21', 1.32, { agua: 'S' }),
  L('Sintra', 'Sintra', 'Lisboa', 'Lisboa e Vale do Tejo', 38.8029, -9.3817, 2, '2710', '21', 1.12, { sufixo: 'da Serra' }),
  L('Amadora', 'Amadora', 'Lisboa', 'Lisboa e Vale do Tejo', 38.7538, -9.2308, 2, '2700', '21', 1.1),
  L('Odivelas', 'Odivelas', 'Lisboa', 'Lisboa e Vale do Tejo', 38.7928, -9.1838, 1, '2675', '21', 1.08),
  L('Loures', 'Loures', 'Lisboa', 'Lisboa e Vale do Tejo', 38.8308, -9.1684, 1, '2670', '21', 1.05),
  L('Vila Franca de Xira', 'Vila Franca de Xira', 'Lisboa', 'Lisboa e Vale do Tejo', 38.9553, -8.995, 1, '2600', '263', 1.0, { agua: 'E', sufixo: 'do Tejo' }),
  L('Mafra', 'Mafra', 'Lisboa', 'Lisboa e Vale do Tejo', 38.9369, -9.3276, 1, '2640', '261', 1.02),
  L('Torres Vedras', 'Torres Vedras', 'Lisboa', 'Lisboa e Vale do Tejo', 39.0911, -9.2586, 1, '2560', '261', 0.98, { sufixo: 'do Oeste' }),
  // Setúbal
  L('Almada', 'Almada', 'Setúbal', 'Lisboa e Vale do Tejo', 38.67, -9.155, 2, '2800', '21', 1.08, { agua: 'N', sufixo: 'do Tejo' }),
  L('Amora', 'Seixal', 'Setúbal', 'Lisboa e Vale do Tejo', 38.623, -9.117, 1, '2845', '21', 1.0, { agua: 'N' }),
  L('Barreiro', 'Barreiro', 'Setúbal', 'Lisboa e Vale do Tejo', 38.65, -9.06, 1, '2830', '21', 0.98, { agua: 'NW' }),
  L('Setúbal', 'Setúbal', 'Setúbal', 'Lisboa e Vale do Tejo', 38.53, -8.89, 2, '2900', '265', 1.0, { agua: 'S', sufixo: 'do Sado' }),
  L('Palmela', 'Palmela', 'Setúbal', 'Lisboa e Vale do Tejo', 38.5689, -8.9014, 1, '2950', '21', 0.98, { sufixo: 'da Arrábida' }),
  L('Montijo', 'Montijo', 'Setúbal', 'Lisboa e Vale do Tejo', 38.705, -8.965, 1, '2870', '21', 0.98, { agua: 'W' }),
  L('Sesimbra', 'Sesimbra', 'Setúbal', 'Lisboa e Vale do Tejo', 38.456, -9.095, 1, '2970', '21', 1.0, { agua: 'S', sufixo: 'da Arrábida' }),
  L('Alcácer do Sal', 'Alcácer do Sal', 'Setúbal', 'Alentejo', 38.376, -8.51, 1, '7580', '265', 0.85, { agua: 'S', sufixo: 'do Sado' }),
  L('Grândola', 'Grândola', 'Setúbal', 'Alentejo', 38.177, -8.568, 1, '7570', '269', 0.85, { sufixo: 'Alentejano' }),
  L('Santiago do Cacém', 'Santiago do Cacém', 'Setúbal', 'Alentejo', 38.015, -8.694, 1, '7540', '269', 0.85),
  // Évora / Portalegre / Beja
  L('Évora', 'Évora', 'Évora', 'Alentejo', 38.5714, -7.9135, 3, '7000', '266', 0.88, { sufixo: 'da Planície' }),
  L('Estremoz', 'Estremoz', 'Évora', 'Alentejo', 38.844, -7.586, 1, '7100', '268', 0.8),
  L('Montemor-o-Novo', 'Montemor-o-Novo', 'Évora', 'Alentejo', 38.648, -8.216, 1, '7050', '266', 0.82),
  L('Reguengos de Monsaraz', 'Reguengos de Monsaraz', 'Évora', 'Alentejo', 38.425, -7.534, 1, '7200', '266', 0.8, { sufixo: 'do Alqueva' }),
  L('Vendas Novas', 'Vendas Novas', 'Évora', 'Alentejo', 38.678, -8.456, 1, '7080', '265', 0.82),
  L('Portalegre', 'Portalegre', 'Portalegre', 'Alentejo', 39.2967, -7.4285, 1, '7300', '245', 0.78, { sufixo: 'de São Mamede' }),
  L('Elvas', 'Elvas', 'Portalegre', 'Alentejo', 38.88, -7.163, 1, '7350', '268', 0.78),
  L('Ponte de Sor', 'Ponte de Sor', 'Portalegre', 'Alentejo', 39.25, -8.01, 1, '7400', '242', 0.78),
  L('Beja', 'Beja', 'Beja', 'Alentejo', 38.0151, -7.8632, 2, '7800', '284', 0.8, { sufixo: 'do Baixo Alentejo' }),
  L('Serpa', 'Serpa', 'Beja', 'Alentejo', 37.945, -7.598, 1, '7830', '284', 0.78),
  L('Moura', 'Moura', 'Beja', 'Alentejo', 38.14, -7.4486, 1, '7860', '285', 0.78),
  L('Odemira', 'Odemira', 'Beja', 'Alentejo', 37.597, -8.64, 1, '7630', '283', 0.82, { sufixo: 'do Mira' }),
  // Algarve
  L('Faro', 'Faro', 'Faro', 'Algarve', 37.023, -7.935, 2, '8000', '289', 1.08, { agua: 'S', sufixo: 'do Algarve' }),
  L('Loulé', 'Loulé', 'Faro', 'Algarve', 37.138, -8.02, 2, '8100', '289', 1.08, { sufixo: 'do Algarve' }),
  L('Albufeira', 'Albufeira', 'Faro', 'Algarve', 37.095, -8.245, 1, '8200', '289', 1.1, { agua: 'S' }),
  L('Portimão', 'Portimão', 'Faro', 'Algarve', 37.138, -8.537, 2, '8500', '282', 1.05, { agua: 'SE', sufixo: 'do Barlavento' }),
  L('Lagos', 'Lagos', 'Faro', 'Algarve', 37.105, -8.68, 1, '8600', '282', 1.08, { agua: 'SE', sufixo: 'do Barlavento' }),
  L('Tavira', 'Tavira', 'Faro', 'Algarve', 37.127, -7.65, 1, '8800', '281', 1.02, { agua: 'S', sufixo: 'do Sotavento' }),
  L('Olhão', 'Olhão', 'Faro', 'Algarve', 37.032, -7.84, 1, '8700', '289', 1.0, { agua: 'S', sufixo: 'da Ria Formosa' }),
  L('Silves', 'Silves', 'Faro', 'Algarve', 37.189, -8.438, 1, '8300', '282', 0.98, { sufixo: 'do Arade' }),
  L('São Brás de Alportel', 'São Brás de Alportel', 'Faro', 'Algarve', 37.152, -7.888, 1, '8150', '289', 1.0),
  // Regiões autónomas
  L('Funchal', 'Funchal', 'Madeira', 'Madeira', 32.655, -16.915, 2, '9000', '291', 1.0, { agua: 'S', sufixo: 'da Madeira' }),
  L('Câmara de Lobos', 'Câmara de Lobos', 'Madeira', 'Madeira', 32.656, -16.975, 1, '9300', '291', 0.92, { agua: 'S' }),
  L('Santa Cruz', 'Santa Cruz', 'Madeira', 'Madeira', 32.69, -16.8, 1, '9100', '291', 0.95, { agua: 'E' }),
  L('Ponta Delgada', 'Ponta Delgada', 'Açores', 'Açores', 37.748, -25.67, 2, '9500', '296', 0.95, { agua: 'S', sufixo: 'dos Açores' }),
  L('Ribeira Grande', 'Ribeira Grande', 'Açores', 'Açores', 37.815, -25.52, 1, '9600', '296', 0.88, { agua: 'N' }),
  L('Angra do Heroísmo', 'Angra do Heroísmo', 'Açores', 'Açores', 38.66, -27.22, 1, '9700', '295', 0.9, { agua: 'S', sufixo: 'da Terceira' }),
]

export const DISTRITOS: Distrito[] = [
  'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora', 'Faro', 'Guarda', 'Leiria',
  'Lisboa', 'Portalegre', 'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu', 'Madeira', 'Açores',
]

export const REGIOES: Regiao[] = ['Norte', 'Centro', 'Lisboa e Vale do Tejo', 'Alentejo', 'Algarve', 'Madeira', 'Açores']

/** Lugares sugeridos na pesquisa por texto (concelhos únicos + cidades). */
export interface LugarPesquisa {
  label: string
  lat: number
  lng: number
  distrito: Distrito
  /** raio sugerido (km) */
  raio: number
}

function construirLugares(): LugarPesquisa[] {
  const porConcelho = new Map<string, { lat: number; lng: number; n: number; distrito: Distrito }>()
  for (const l of LOCALIDADES) {
    const c = porConcelho.get(l.concelho)
    if (c) {
      c.lat = (c.lat * c.n + l.lat) / (c.n + 1)
      c.lng = (c.lng * c.n + l.lng) / (c.n + 1)
      c.n++
    } else porConcelho.set(l.concelho, { lat: l.lat, lng: l.lng, n: 1, distrito: l.distrito })
  }
  const lugares: LugarPesquisa[] = [...porConcelho.entries()].map(([label, c]) => ({
    label,
    lat: c.lat,
    lng: c.lng,
    distrito: c.distrito,
    raio: label === 'Lisboa' || label === 'Porto' ? 12 : 15,
  }))
  // zonas dentro de Lisboa/Porto/Coimbra
  for (const l of LOCALIDADES) {
    if (l.nome.includes(' — ')) lugares.push({ label: l.nome, lat: l.lat, lng: l.lng, distrito: l.distrito, raio: 5 })
  }
  return lugares.sort((a, b) => a.label.localeCompare(b.label, 'pt'))
}

export const LUGARES: LugarPesquisa[] = construirLugares()

/** Centróide aproximado de cada distrito/região autónoma (para pesquisa por distrito). */
export const CENTRO_DISTRITO: Record<Distrito, { lat: number; lng: number; zoom: number }> = {
  Aveiro: { lat: 40.72, lng: -8.55, zoom: 9 },
  Beja: { lat: 37.9, lng: -7.9, zoom: 9 },
  Braga: { lat: 41.5, lng: -8.4, zoom: 10 },
  Bragança: { lat: 41.6, lng: -6.95, zoom: 9 },
  'Castelo Branco': { lat: 39.95, lng: -7.5, zoom: 9 },
  Coimbra: { lat: 40.2, lng: -8.5, zoom: 9 },
  Évora: { lat: 38.6, lng: -7.9, zoom: 9 },
  Faro: { lat: 37.12, lng: -8.1, zoom: 9 },
  Guarda: { lat: 40.5, lng: -7.3, zoom: 9 },
  Leiria: { lat: 39.65, lng: -8.9, zoom: 9 },
  Lisboa: { lat: 38.8, lng: -9.2, zoom: 10 },
  Portalegre: { lat: 39.15, lng: -7.6, zoom: 9 },
  Porto: { lat: 41.2, lng: -8.55, zoom: 10 },
  Santarém: { lat: 39.3, lng: -8.5, zoom: 9 },
  Setúbal: { lat: 38.4, lng: -8.8, zoom: 9 },
  'Viana do Castelo': { lat: 41.75, lng: -8.6, zoom: 10 },
  'Vila Real': { lat: 41.4, lng: -7.6, zoom: 9 },
  Viseu: { lat: 40.8, lng: -7.9, zoom: 9 },
  Madeira: { lat: 32.7, lng: -16.95, zoom: 10 },
  Açores: { lat: 38.3, lng: -27.0, zoom: 7 },
}
