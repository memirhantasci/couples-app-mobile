-- ============================================================================
-- MIGRATION: 20260907_seed_hipparcos_stars.sql
-- Hipparcos Gökyüzü Referans Kataloğu Genişletmesi
-- Eklenen Yıldız Sayısı: 489 (Toplam Katalog: 524 Yıldız)
-- Kapsam: Görünür parlaklık (magnitude) <= 6.50 olan gökyüzünün gözle görülebilir yıldızları
-- ============================================================================

INSERT INTO public.celestial_catalog 
  (catalog_code, ra, dec, magnitude, spectral_type, base_color)
VALUES
  ('HIP-26727',  84.0533,  -0.2991, 2.23, 'O9.5II', '#8AABFF'),  -- Mintaka (Delta Ori)
  ('HIP-26311',  83.0016,  -9.6696, 2.06, 'B0.5Ia', '#A5C3FF'),  -- Saiph (Kappa Ori)
  ('HIP-26756',  84.4112,  -1.9426, 1.77, 'O9.5Ib', '#8AABFF'),  -- Alnitak (Zeta Ori)
  ('HIP-26207',  83.7844,   9.9341, 3.39, 'O8III', '#8AABFF'),  -- Meissa (Lambda Ori)
  ('HIP-23875',  76.5186,   1.7135, 3.19, 'F6V', '#F8F9FB'),  -- Tabit (Pi3 Ori)
  ('HIP-26241',  83.8583,  -5.9099, 2.77, 'O9III', '#8AABFF'),  -- Hatysa (Iota Ori)
  ('HIP-27059',  85.1897,  -2.3970, 3.80, 'B3V', '#A5C3FF'),  -- Sigma Ori
  ('HIP-25930',  82.7771,  -7.3045, 4.09, 'B2III', '#A5C3FF'),  -- Eta Ori
  ('HIP-53910', 165.4603,  56.3824, 2.37, 'A1V', '#DCE6FF'),  -- Merak (Beta UMa)
  ('HIP-58001', 178.4577,  53.6948, 2.44, 'A0Ve', '#DCE6FF'),  -- Phad (Gamma UMa)
  ('HIP-59774', 183.8569,  57.0326, 3.31, 'A3V', '#DCE6FF'),  -- Megrez (Delta UMa)
  ('HIP-62956', 193.5073,  55.9598, 1.77, 'A0Vp', '#DCE6FF'),  -- Alioth (Epsilon UMa)
  ('HIP-67301', 206.8852,  49.3133, 1.86, 'B3V', '#A5C3FF'),  -- Alkaid (Eta UMa)
  ('HIP-44471', 136.4258,  48.0418, 3.14, 'A7IV', '#DCE6FF'),  -- Talitha (Iota UMa)
  ('HIP-55203', 169.9678,  33.0939, 3.05, 'K3III', '#FFD2A1'),  -- Tania Borealis (Lambda UMa)
  ('HIP-51814', 159.2274,  42.9152, 3.45, 'F6IV', '#F8F9FB'),  -- Tania Australis (Mu UMa)
  ('HIP-57399', 176.6022,  44.4985, 3.79, 'M0III', '#FF8F35'),  -- Alula Borealis (Nu UMa)
  ('HIP-55282', 170.2155,  31.5292, 3.79, 'G0V', '#FFECC3'),  -- Alula Australis (Xi UMa)
  ('HIP-41307', 126.7938,  60.7180, 3.67, 'K1III', '#FFD2A1'),  -- Muscida (Omicron UMa)
  ('HIP-43100', 132.3275,  65.0211, 3.36, 'G5III', '#FFECC3'),  -- Muscida (Pi2 UMa)
  ('HIP-72607', 222.6764,  74.1555, 2.08, 'K4III', '#FFD2A1'),  -- Kochab (Beta UMi)
  ('HIP-75097', 230.1775,  71.8340, 3.05, 'A3II', '#DCE6FF'),  -- Pherkad (Gamma UMi)
  ('HIP-85822', 263.1415,  77.7944, 4.22, 'K5III', '#FFD2A1'),  -- Yildun (Delta UMi)
  ('HIP-82080', 251.4888,  75.7538, 4.36, 'G5III', '#FFECC3'),  -- Urodelus (Epsilon UMi)
  ('HIP-77055', 235.8752,  77.7944, 4.29, 'A3Vn', '#DCE6FF'),  -- Ahfa al Farkadain (Zeta UMi)
  ('HIP-3179',  10.1268,  56.5373, 2.23, 'K0III', '#FFD2A1'),  -- Schedar (Alpha Cas)
  ('HIP-746',   2.2945,  59.1498, 2.27, 'F2III', '#F8F9FB'),  -- Caph (Beta Cas)
  ('HIP-4427',  14.1772,  60.7167, 2.47, 'B0IVe', '#A5C3FF'),  -- Tsih (Gamma Cas)
  ('HIP-6686',  21.4540,  60.2353, 2.68, 'A5V', '#DCE6FF'),  -- Ruchbah (Delta Cas)
  ('HIP-8588',  26.1601,  63.6701, 3.37, 'B3V', '#A5C3FF'),  -- Segin (Epsilon Cas)
  ('HIP-3821',  12.2754,  57.8152, 3.44, 'G0V', '#FFECC3'),  -- Achird (Eta Cas)
  ('HIP-11569',  37.3117,  67.4022, 4.19, 'A7III', '#DCE6FF'),  -- Theta Cas
  ('HIP-100453', 305.5571,  40.2567, 2.23, 'F8Ib', '#F8F9FB'),  -- Sadr (Gamma Cyg)
  ('HIP-102488', 311.9604,  33.9703, 2.46, 'K0III', '#FFD2A1'),  -- Gienah (Epsilon Cyg)
  ('HIP-97165', 296.2437,  45.1306, 2.87, 'B9.5IV', '#A5C3FF'),  -- Fawaris (Delta Cyg)
  ('HIP-95947', 292.6803,  27.9597, 3.08, 'K3II', '#FFD2A1'),  -- Albireo (Beta Cyg)
  ('HIP-104732', 318.5714,  30.2238, 3.89, 'K0III', '#FFD2A1'),  -- Zeta Cyg
  ('HIP-99639', 303.2208,  46.8928, 4.23, 'K0III', '#FFD2A1'),  -- Xi Cyg
  ('HIP-101138', 307.7292,  49.3175, 3.75, 'A5V', '#DCE6FF'),  -- Omicron1 Cyg
  ('HIP-93194', 284.9767,  32.6902, 3.24, 'B9.5II', '#A5C3FF'),  -- Sulafat (Gamma Lyr)
  ('HIP-92420', 282.5186,  33.3627, 3.45, 'B7V', '#A5C3FF'),  -- Sheliak (Beta Lyr)
  ('HIP-92791', 283.6961,  36.9008, 4.33, 'A8V', '#DCE6FF'),  -- Delta2 Lyr
  ('HIP-93408', 285.5901,  37.6046, 4.67, 'A4V', '#DCE6FF'),  -- Epsilon1 Lyr (Double-Double)
  ('HIP-97278', 296.5653,  10.6133, 2.72, 'K3II', '#FFD2A1'),  -- Tarazed (Gamma Aql)
  ('HIP-98036', 298.8284,   6.4074, 3.71, 'G8IV', '#FFECC3'),  -- Alshain (Beta Aql)
  ('HIP-93747', 286.3531,  13.8624, 2.99, 'B9.5III', '#A5C3FF'),  -- Deneb el Okab (Zeta Aql)
  ('HIP-95501', 291.6888,  15.0673, 3.36, 'B9V', '#A5C3FF'),  -- Deneb el Okab Borealis (Epsilon Aql)
  ('HIP-95447', 291.5377,   3.1152, 3.36, 'F0IV', '#F8F9FB'),  -- Delta Aql
  ('HIP-98110', 298.9866,  -0.7025, 3.23, 'B9.5III', '#A5C3FF'),  -- Theta Aql
  ('HIP-113963', 346.2443,  28.0828, 2.42, 'M2.5II', '#FF8F35'),  -- Scheat (Beta Peg)
  ('HIP-107315', 326.0465,   9.8750, 2.39, 'K2Ib', '#FFD2A1'),  -- Enif (Epsilon Peg)
  ('HIP-110997', 337.4087,  10.8314, 3.40, 'B8V', '#A5C3FF'),  -- Homam (Zeta Peg)
  ('HIP-111954', 340.2312,  30.2212, 2.94, 'G2II', '#FFECC3'),  -- Matar (Eta Peg)
  ('HIP-110003', 334.4608,   6.1977, 3.53, 'B9V', '#A5C3FF'),  -- Baham (Theta Peg)
  ('HIP-113244', 344.2778,  24.6014, 3.51, 'M2III', '#FF8F35'),  -- Sadalbari (Mu Peg)
  ('HIP-5447',  17.4330,  35.6206, 2.06, 'M0III', '#FF8F35'),  -- Mirach (Beta And)
  ('HIP-9640',  30.9748,  42.3327, 2.10, 'K3II', '#FFD2A1'),  -- Almach (Gamma1 And)
  ('HIP-3092',   9.8322,  30.8610, 3.28, 'K3III', '#FFD2A1'),  -- Delta And
  ('HIP-4132',  13.2427,  40.8938, 4.47, 'K0III', '#FFD2A1'),  -- Adhil (Xi And)
  ('HIP-116584', 354.8373,  42.7958, 4.14, 'A2V', '#DCE6FF'),  -- Omicron And
  ('HIP-3013',   9.5828,  29.3117, 4.26, 'A3V', '#DCE6FF'),  -- Zeta And
  ('HIP-25428',  81.5729,  28.6075, 1.65, 'B7III', '#A5C3FF'),  -- Elnath (Beta Tau)
  ('HIP-17702',  56.8711,  24.1051, 2.87, 'B7III', '#A5C3FF'),  -- Alcyone (Eta Tau / Pleiades)
  ('HIP-17499',  56.2189,  24.1133, 3.70, 'B6III', '#A5C3FF'),  -- Electra (17 Tau)
  ('HIP-17573',  56.4719,  24.3676, 3.87, 'B8III', '#A5C3FF'),  -- Maia (20 Tau)
  ('HIP-17608',  56.5815,  23.9639, 4.17, 'B6IV', '#A5C3FF'),  -- Merope (23 Tau)
  ('HIP-17743',  57.0199,  24.0534, 3.63, 'B8III', '#A5C3FF'),  -- Atlas (27 Tau)
  ('HIP-20889',  67.1542,  15.6276, 3.65, 'G8III', '#FFECC3'),  -- Ain (Epsilon Tau / Hyades)
  ('HIP-20205',  64.9546,  15.7944, 3.76, 'K0III', '#FFD2A1'),  -- Hyadum I (Gamma Tau)
  ('HIP-20455',  65.7335,  17.5422, 3.84, 'K0III', '#FFD2A1'),  -- Hyadum II (Delta1 Tau)
  ('HIP-27072',  85.2458,  21.1425, 3.00, 'B2IV', '#A5C3FF'),  -- Tianguan (Zeta Tau)
  ('HIP-31681',  99.4278,  16.3989, 1.93, 'A1IV', '#DCE6FF'),  -- Alhena (Gamma Gem)
  ('HIP-35550', 110.0315,  21.9822, 3.53, 'F6IV', '#F8F9FB'),  -- Wasat (Delta Gem)
  ('HIP-32249', 101.2885,  25.1311, 2.98, 'G8Ib', '#FFECC3'),  -- Mebsuta (Epsilon Gem)
  ('HIP-30343',  95.7400,  22.5061, 2.88, 'M3III', '#FF8F35'),  -- Tejat (Mu Gem)
  ('HIP-29651',  93.7108,  22.5097, 3.31, 'B9V', '#A5C3FF'),  -- Propus (Eta Gem)
  ('HIP-34088', 105.7151,  20.5702, 3.58, 'F8Ib', '#F8F9FB'),  -- Mekbuda (Zeta Gem)
  ('HIP-37740', 115.9088,  24.3980, 3.60, 'K0III', '#FFD2A1'),  -- Kappa Gem
  ('HIP-50583', 154.9928,  19.8415, 2.01, 'K0III', '#FFD2A1'),  -- Algieba (Gamma Leo)
  ('HIP-54872', 177.2649,  14.5721, 2.14, 'A3V', '#DCE6FF'),  -- Denebola (Beta Leo)
  ('HIP-54879', 177.2882,  20.5239, 2.56, 'A4V', '#DCE6FF'),  -- Zosma (Delta Leo)
  ('HIP-54844', 177.1652,  15.4286, 3.33, 'A2V', '#DCE6FF'),  -- Chertan (Theta Leo)
  ('HIP-48455', 148.1904,  26.0069, 2.98, 'K3III', '#FFD2A1'),  -- Rasalas (Mu Leo)
  ('HIP-49583', 151.8329,  23.4172, 3.44, 'A0V', '#DCE6FF'),  -- Adhafera (Zeta Leo)
  ('HIP-47908', 146.4628,   9.9744, 3.52, 'F0IV', '#F8F9FB'),  -- Subra (Omicron Leo)
  ('HIP-54539', 176.2238,  10.5303, 3.88, 'G8III', '#FFECC3'),  -- Iota Leo
  ('HIP-61941', 190.4150,  -1.4497, 2.74, 'F0V', '#F8F9FB'),  -- Porrima (Gamma Vir)
  ('HIP-63608', 195.5458,  10.9592, 2.83, 'G8III', '#FFECC3'),  -- Vindemiatrix (Epsilon Vir)
  ('HIP-66249', 203.8822,  -0.6669, 3.38, 'A3V', '#DCE6FF'),  -- Heze (Zeta Vir)
  ('HIP-60129', 184.8437,  -0.6669, 3.61, 'F7V', '#F8F9FB'),  -- Zavijava (Beta Vir)
  ('HIP-60965', 187.4665,   3.3975, 3.89, 'F7V', '#F8F9FB'),  -- Zaniah (Eta Vir)
  ('HIP-69974', 214.7709,  -5.5399, 4.08, 'F2V', '#F8F9FB'),  -- Syrma (Iota Vir)
  ('HIP-71957', 220.5218, -10.6658, 4.24, 'A0V', '#DCE6FF'),  -- Kang (Kappa Vir)
  ('HIP-78820', 241.3590, -19.8054, 2.62, 'B0.5IV', '#A5C3FF'),  -- Graffias (Beta Sco)
  ('HIP-78401', 240.0833, -22.6219, 2.32, 'B0.3IV', '#A5C3FF'),  -- Dschubba (Delta Sco)
  ('HIP-82514', 252.9675, -34.2936, 2.29, 'K2.5III', '#FFD2A1'),  -- Larawag (Epsilon Sco)
  ('HIP-86228', 264.3297, -42.9978, 1.86, 'F1II', '#F8F9FB'),  -- Sargas (Theta Sco)
  ('HIP-84143', 257.9950, -37.3375, 2.41, 'F0Ia', '#F8F9FB'),  -- Iota1 Sco
  ('HIP-85696', 262.6922, -39.0303, 2.41, 'B1.5III', '#A5C3FF'),  -- Girtab (Kappa Sco)
  ('HIP-86263', 264.3988, -37.2958, 2.69, 'B2IV', '#A5C3FF'),  -- Lesath (Upsilon Sco)
  ('HIP-79374', 243.0488, -25.5828, 2.89, 'B2IV', '#A5C3FF'),  -- Fang (Pi Sco)
  ('HIP-82396', 252.6083, -42.3606, 3.00, 'B2IV', '#A5C3FF'),  -- Mu1 Sco
  ('HIP-90185', 275.9975, -34.3842, 1.79, 'B9.5III', '#A5C3FF'),  -- Kaus Australis (Epsilon Sgr)
  ('HIP-92855', 283.8162, -26.2967, 2.05, 'B2.5V', '#A5C3FF'),  -- Nunki (Sigma Sgr)
  ('HIP-93864', 286.9771, -29.8803, 2.59, 'A2V', '#DCE6FF'),  -- Ascella (Zeta Sgr)
  ('HIP-89931', 275.3958, -29.8281, 2.70, 'K3III', '#FFD2A1'),  -- Kaus Media (Delta Sgr)
  ('HIP-90496', 276.9933, -21.0594, 2.82, 'K1III', '#FFD2A1'),  -- Kaus Borealis (Lambda Sgr)
  ('HIP-88635', 271.4421, -30.4242, 2.98, 'K0III', '#FFD2A1'),  -- Alnasl (Gamma2 Sgr)
  ('HIP-93683', 286.4271, -21.1114, 3.17, 'B8V', '#A5C3FF'),  -- Phi Sgr
  ('HIP-94859', 289.9675, -44.4589, 3.96, 'B8V', '#A5C3FF'),  -- Rukbat (Alpha Sgr)
  ('HIP-95241', 290.7933, -44.8019, 3.97, 'B9V', '#A5C3FF'),  -- Arkab Prior (Beta1 Sgr)
  ('HIP-93506', 286.0825, -36.7925, 3.49, 'B9.5III', '#A5C3FF'),  -- Tau Sgr
  ('HIP-30324',  95.6750, -17.9558, 1.98, 'B1II', '#A5C3FF'),  -- Murzim (Beta CMa)
  ('HIP-34444', 106.0275, -26.3933, 1.83, 'F8Ia', '#F8F9FB'),  -- Wezen (Delta CMa)
  ('HIP-35904', 111.0238, -29.3031, 2.45, 'B5Ia', '#A5C3FF'),  -- Aludra (Eta CMa)
  ('HIP-30122',  28.0261, -30.0633, 3.02, 'B2.5V', '#A5C3FF'),  -- Furud (Zeta CMa)
  ('HIP-31978', 100.1804, -17.0567, 4.11, 'B8II', '#A5C3FF'),  -- Muliphein (Gamma CMa)
  ('HIP-33856', 104.6562, -27.9344, 3.86, 'K4III', '#FFD2A1'),  -- Sigma CMa
  ('HIP-36188', 111.7850,   8.2936, 2.89, 'B8Ve', '#A5C3FF'),  -- Gomeisa (Beta CMi)
  ('HIP-35228', 109.1171,   8.9242, 4.33, 'K3III', '#FFD2A1'),  -- Gamma CMi
  ('HIP-74376', 228.0700,  27.0742, 2.70, 'K0III', '#FFD2A1'),  -- Izar (Epsilon Boo)
  ('HIP-67927', 208.6717,  18.3972, 2.68, 'G0IV', '#FFECC3'),  -- Muphrid (Eta Boo)
  ('HIP-71075', 217.9625,  38.3083, 3.04, 'A7III', '#DCE6FF'),  -- Seginus (Gamma Boo)
  ('HIP-73555', 225.4371,  40.3900, 3.49, 'G8III', '#FFECC3'),  -- Nekkar (Beta Boo)
  ('HIP-71908', 220.4079,  13.7317, 3.47, 'A7V', '#DCE6FF'),  -- Delta Boo
  ('HIP-70692', 217.1583,  15.7989, 3.75, 'K4III', '#FFD2A1'),  -- Rho Boo
  ('HIP-76267', 233.6719,  26.7147, 2.22, 'A0V', '#DCE6FF'),  -- Alphecca (Alpha CrB)
  ('HIP-75695', 231.8604,  29.1103, 3.66, 'F0p', '#F8F9FB'),  -- Nusakan (Beta CrB)
  ('HIP-77058', 235.8779,  26.3442, 3.81, 'B9V', '#A5C3FF'),  -- Gamma CrB
  ('HIP-77655', 237.0396,  33.7997, 4.59, 'M2III', '#FF8F35'),  -- Tseen Tung (Epsilon CrB)
  ('HIP-80816', 247.5529,  21.4897, 2.78, 'G7III', '#FFECC3'),  -- Kornephoros (Beta Her)
  ('HIP-84345', 258.6621,  14.3903, 3.12, 'M5Ib', '#FF8F35'),  -- Rasalgethi (Alpha Her)
  ('HIP-86414', 264.8488,  27.7242, 3.12, 'A3IV', '#DCE6FF'),  -- Sarin (Delta Her)
  ('HIP-83895', 257.7767,  30.9250, 3.42, 'A0V', '#DCE6FF'),  -- Zeta Her
  ('HIP-88794', 271.7458,  37.2511, 3.77, 'K1III', '#FFD2A1'),  -- Pi Her
  ('HIP-83207', 255.4379,  26.0469, 3.92, 'K3III', '#FFD2A1'),  -- Marfik (Epsilon Her)
  ('HIP-84012', 257.9408, -15.7244, 2.54, 'M0.5III', '#FF8F35'),  -- Yed Prior (Delta Oph)
  ('HIP-84405', 258.8258,  -4.6922, 3.23, 'G9.5III', '#FFECC3'),  -- Yed Posterior (Epsilon Oph)
  ('HIP-84970', 260.6054,   9.3800, 2.76, 'K2III', '#FFD2A1'),  -- Cebalrai (Beta Oph)
  ('HIP-86742', 265.8504, -15.7289, 2.43, 'A2.5Va', '#DCE6FF'),  -- Sabik (Eta Oph real)
  ('HIP-81693', 250.4225, -10.5678, 2.57, 'O9.5V', '#8AABFF'),  -- Zeta Oph
  ('HIP-85258', 261.2721, -24.9997, 3.27, 'A0V', '#DCE6FF'),  -- Kappa Oph
  ('HIP-68933', 211.3650, -36.3700, 2.06, 'K0III', '#FFD2A1'),  -- Menkent (Theta Cen)
  ('HIP-67464', 207.3196, -42.4739, 2.55, 'B2IV', '#A5C3FF'),  -- Muhlifain (Gamma Cen)
  ('HIP-68282', 209.7917, -50.7225, 2.75, 'B2IV', '#A5C3FF'),  -- Epsilon Cen
  ('HIP-60351', 185.3400, -48.9592, 3.06, 'A0V', '#DCE6FF'),  -- Zeta Cen
  ('HIP-68002', 209.0062, -36.1953, 3.12, 'B2.5IV', '#A5C3FF'),  -- Eta Cen
  ('HIP-59196', 181.9967, -58.7497, 2.80, 'B3V', '#A5C3FF'),  -- Delta Cen
  ('HIP-45238', 138.3004, -69.7172, 1.67, 'A2IV', '#DCE6FF'),  -- Miaplacidus (Beta Car)
  ('HIP-41037', 125.6288, -59.5097, 1.86, 'K3III', '#FFD2A1'),  -- Avior (Epsilon Car)
  ('HIP-45556', 139.2733, -70.0378, 2.21, 'A8Ib', '#DCE6FF'),  -- Aspidiske (Iota Car)
  ('HIP-46390', 141.7454, -55.0103, 2.74, 'B0Vp', '#A5C3FF'),  -- Theta Car
  ('HIP-52419', 161.0258, -61.3283, 2.92, 'B2IV', '#A5C3FF'),  -- Upsilon Car
  ('HIP-49841', 152.6200, -60.6444, 3.29, 'B4V', '#A5C3FF'),  -- Omega Car
  ('HIP-39953', 122.3842, -47.3367, 1.75, 'WC8+O9I', '#FFFFFF'),  -- Regor (Gamma2 Vel)
  ('HIP-44816', 137.0858, -54.5683, 1.93, 'A1III', '#DCE6FF'),  -- Alsephina (Delta Vel)
  ('HIP-42913', 131.1771, -54.7078, 2.47, 'B2IV', '#A5C3FF'),  -- Kalahen (Kappa Vel)
  ('HIP-44700', 136.7454, -43.4325, 2.21, 'K4.5Ib', '#FFD2A1'),  -- Suhail (Lambda Vel)
  ('HIP-45941', 140.4079, -55.1053, 2.80, 'B3IV', '#A5C3FF'),  -- Mu Vel
  ('HIP-42828', 130.8804, -40.4667, 3.52, 'A5II', '#DCE6FF'),  -- Psi Vel
  ('HIP-39429', 120.8958, -40.0050, 2.21, 'O4I', '#8AABFF'),  -- Naos (Zeta Pup)
  ('HIP-38170', 117.2029, -24.3039, 2.81, 'K3Ib', '#FFD2A1'),  -- Tureis (Rho Pup)
  ('HIP-37590', 115.7029, -28.9564, 3.34, 'G6II', '#FFECC3'),  -- Asmidiske (Xi Pup)
  ('HIP-35264', 109.1979, -27.8444, 3.17, 'F3Ib', '#F8F9FB'),  -- Sigma Pup
  ('HIP-14135',  45.9612, -40.3047, 2.88, 'A3IV', '#DCE6FF'),  -- Acamar (Theta1 Eri)
  ('HIP-16611',  53.9458,  -5.0897, 2.78, 'A3III', '#DCE6FF'),  -- Cursa (Beta Eri)
  ('HIP-17358',  55.7725,  -9.7633, 2.97, 'M0.5III', '#FF8F35'),  -- Zaurak (Gamma Eri)
  ('HIP-17851',  57.3488, -42.2956, 3.56, 'K1III', '#FFD2A1'),  -- Angetenar (Tau4 Eri)
  ('HIP-16537',  53.7125,  -9.4583, 3.72, 'K2V', '#FFD2A1'),  -- Ran (Epsilon Eri)
  ('HIP-19349',  62.4088,  -9.7969, 3.52, 'K0IV', '#FFD2A1'),  -- Rana (Delta Eri)
  ('HIP-28360',  89.9408,  44.9472, 1.90, 'A2IV', '#DCE6FF'),  -- Menkalinan (Beta Aur)
  ('HIP-28380',  90.0071,  37.2125, 2.99, 'A0p', '#DCE6FF'),  -- Mahasim (Theta Aur)
  ('HIP-23453',  75.3129,  43.8233, 2.69, 'K3II', '#FFD2A1'),  -- Hassaleh (Iota Aur)
  ('HIP-23416',  75.1979,  41.2339, 3.80, 'F0II', '#F8F9FB'),  -- Almaaz (Epsilon Aur)
  ('HIP-23685',  75.9221,  41.0772, 3.69, 'B3V', '#A5C3FF'),  -- Haedus (Eta Aur)
  ('HIP-23767',  76.1825,  30.4908, 3.75, 'K5III', '#FFD2A1'),  -- Sadatoni (Zeta Aur)
  ('HIP-14354',  47.0421,  40.9556, 2.12, 'B8V', '#A5C3FF'),  -- Algol (Beta Per)
  ('HIP-18532',  59.4633,  47.7125, 3.01, 'B0.5III', '#A5C3FF'),  -- Menkib (Xi Per)
  ('HIP-17448',  56.0804,  31.8833, 2.84, 'B1Ib', '#A5C3FF'),  -- Atik (Zeta Per)
  ('HIP-15863',  51.0788,  38.3242, 3.77, 'A2V', '#DCE6FF'),  -- Gorgonea Tertia (Rho Per)
  ('HIP-13268',  42.6633,  40.0103, 3.98, 'B5III', '#A5C3FF'),  -- Gamma Per
  ('HIP-9884',  31.7933,  23.4625, 2.01, 'K2III', '#FFD2A1'),  -- Hamal (Alpha Ari)
  ('HIP-8903',  28.6538,  20.8081, 2.64, 'A5V', '#DCE6FF'),  -- Sheratan (Beta Ari)
  ('HIP-8832',  28.4062,  19.2947, 3.88, 'A1V', '#DCE6FF'),  -- Mesarthim (Gamma2 Ari)
  ('HIP-14838',  48.2433,  19.7264, 4.35, 'K2III', '#FFD2A1'),  -- Botein (Delta Ari)
  ('HIP-9487',  30.5054,   7.5750, 4.13, 'B9.5V', '#A5C3FF'),  -- Torcular (Omicron Psc)
  ('HIP-114971', 349.7042,   3.2819, 4.48, 'A7IV', '#DCE6FF'),  -- Fumalsamakah (Beta Psc)
  ('HIP-5942',  19.3400,  24.5847, 3.70, 'A0V', '#DCE6FF'),  -- Gamma Psc
  ('HIP-8494',  27.3483,  31.8153, 4.43, 'K0III', '#FFD2A1'),  -- Delta Psc
  ('HIP-109074', 331.4429,  -0.3200, 2.95, 'G2Ib', '#FFECC3'),  -- Sadalmelik (Alpha Aqr)
  ('HIP-106278', 323.0908,  -5.5706, 2.90, 'G0Ib', '#FFECC3'),  -- Sadalsuud (Beta Aqr)
  ('HIP-110395', 335.4379,  -1.3878, 3.86, 'A0V', '#DCE6FF'),  -- Sadachbia (Gamma Aqr)
  ('HIP-113136', 343.8967, -15.8208, 3.27, 'A3V', '#DCE6FF'),  -- Skat (Delta Aqr)
  ('HIP-109939', 334.8879,  -0.0194, 4.42, 'F3III', '#F8F9FB'),  -- Zeta Aqr
  ('HIP-110960', 337.3546,  -7.7828, 4.16, 'G8III', '#FFECC3'),  -- Ancha (Theta Aqr)
  ('HIP-107556', 326.6800, -16.1261, 2.85, 'A5m', '#DCE6FF'),  -- Deneb Algedi (Delta Cap)
  ('HIP-100064', 304.3033, -14.7775, 3.05, 'F8V', '#F8F9FB'),  -- Dabih (Beta Cap)
  ('HIP-100345', 305.1846, -12.5447, 3.58, 'G3Ib', '#FFECC3'),  -- Algedi (Alpha2 Cap)
  ('HIP-106985', 324.9754, -16.6625, 3.69, 'F0V', '#F8F9FB'),  -- Nashira (Gamma Cap)
  ('HIP-105881', 321.7333, -18.7906, 4.49, 'M0III', '#FF8F35'),  -- Zeta Cap
  ('HIP-74785', 229.2521,  -9.3828, 2.61, 'B8V', '#A5C3FF'),  -- Zubeneschamali (Beta Lib)
  ('HIP-72622', 222.7196, -16.0417, 2.75, 'A3IV', '#DCE6FF'),  -- Zubenelgenubi (Alpha2 Lib)
  ('HIP-76333', 233.8783, -25.2658, 3.25, 'M3III', '#FF8F35'),  -- Brachium (Sigma Lib)
  ('HIP-75392', 231.0258, -14.7903, 3.91, 'K0III', '#FFD2A1'),  -- Zubenelhakrabi (Gamma Lib)
  ('HIP-74392', 228.1188, -19.9886, 4.91, 'B9.5V', '#A5C3FF'),  -- Zubenelakribi (Delta Lib)
  ('HIP-109268', 332.0579, -46.9608, 1.73, 'B7IV', '#A5C3FF'),  -- Alnair (Alpha Gru)
  ('HIP-112122', 340.6658, -46.8847, 2.07, 'M5III', '#FF8F35'),  -- Tiaki (Beta Gru)
  ('HIP-108085', 328.3229, -37.3653, 3.00, 'B8III', '#A5C3FF'),  -- Aldhanab (Gamma Gru)
  ('HIP-99',   0.3150, -42.3061, 2.40, 'K0.5III', '#FFD2A1'),  -- Ankaa (Alpha Phe)
  ('HIP-1204',   3.8425, -46.7178, 3.32, 'G8III', '#FFECC3'),  -- Beta Phe
  ('HIP-3419',  10.8971, -17.9867, 2.04, 'K0III', '#FFD2A1'),  -- Diphda (Beta Cet)
  ('HIP-14146',  45.5696,   4.0897, 2.54, 'M1.5III', '#FF8F35'),  -- Menkar (Alpha Cet)
  ('HIP-10826',  29.3562,  -2.9772, 3.47, 'G8.5III', '#FFECC3'),  -- Mira (Omicron Cet)
  ('HIP-11910',  38.8354,  -8.8228, 3.59, 'K2III', '#FFD2A1'),  -- Kaffaljidhma (Gamma Cet)
  ('HIP-8102',  26.0167,  -8.1822, 3.50, 'G8V', '#FFECC3'),  -- Tau Cet
  ('HIP-12706',  41.6508, -10.3347, 3.73, 'K1III', '#FFD2A1'),  -- Baten Kaitos (Zeta Cet)
  ('HIP-87833', 269.1517,  51.4889, 2.24, 'K5III', '#FFD2A1'),  -- Eltanin (Gamma Dra)
  ('HIP-85670', 262.5975,  52.3014, 2.79, 'G2II', '#FFECC3'),  -- Rastaban (Beta Dra)
  ('HIP-82387', 252.5804,  61.5097, 3.07, 'G9III', '#FFECC3'),  -- Aldhibah (Zeta Dra)
  ('HIP-68756', 210.8021,  64.3758, 3.17, 'K0III', '#FFD2A1'),  -- Edasich (Iota Dra)
  ('HIP-68245', 209.6842,  69.3308, 3.67, 'A0III', '#DCE6FF'),  -- Thuban (Alpha Dra)
  ('HIP-94376', 288.0779,  67.6606, 3.73, 'G9III', '#FFECC3'),  -- Altais (Delta Dra)
  ('HIP-80331', 245.9979,  65.7161, 3.82, 'B6III', '#A5C3FF'),  -- Tyl (Epsilon Dra)
  ('HIP-105199', 319.6446,  62.5847, 2.45, 'A7IV', '#DCE6FF'),  -- Alderamin (Alpha Cep)
  ('HIP-106032', 322.3688,  70.5606, 3.23, 'B2III', '#A5C3FF'),  -- Alfirk (Beta Cep)
  ('HIP-116727', 354.7646,  77.6322, 3.21, 'K1III', '#FFD2A1'),  -- Errai (Gamma Cep)
  ('HIP-107259', 325.8712,  58.2014, 4.07, 'F5Ib', '#F8F9FB'),  -- Delta Cep (Prototype Cepheid)
  ('HIP-110991', 337.3875,  70.3608, 4.29, 'A3V', '#DCE6FF'),  -- Kurhah (Xi Cep)
  ('HIP-26451',  83.3229, -17.8222, 2.58, 'F0Ib', '#F8F9FB'),  -- Arneb (Alpha Lep)
  ('HIP-25143',  80.6483, -20.7583, 2.81, 'G5II', '#FFECC3'),  -- Nihal (Beta Lep)
  ('HIP-26939',  84.8117, -34.0717, 2.65, 'B7IV', '#A5C3FF'),  -- Phact (Alpha Col)
  ('HIP-27946',  88.6658, -35.7681, 3.12, 'K1III', '#FFD2A1'),  -- Wazn (Beta Col)
  ('HIP-61359', 188.7067, -23.3967, 2.65, 'G5II', '#FFECC3'),  -- Kraz (Beta Crv)
  ('HIP-61622', 189.5446, -16.5156, 2.94, 'B8V', '#A5C3FF'),  -- Algorab (Delta Crv)
  ('HIP-59199', 182.0150, -22.6194, 3.02, 'B9.5V', '#A5C3FF'),  -- Minkar (Epsilon Crv)
  ('HIP-53975', 165.6667, -17.7689, 4.08, 'K0III', '#FFD2A1'),  -- Alkes (Alpha Crt)
  ('HIP-54917', 167.4371, -18.2989, 3.56, 'A1V', '#DCE6FF'),  -- Delta Crt
  ('HIP-57649', 177.0862, -33.9117, 3.11, 'G8III', '#FFECC3'),  -- Gamma Hya
  ('HIP-42313', 129.4792,   5.7183, 3.90, 'K1III', '#FFD2A1'),  -- Zeta Hya
  ('HIP-56343', 173.2383, -16.1953, 4.11, 'F3V', '#F8F9FB'),  -- Mu Hya
  ('HIP-71860', 220.4829, -41.9961, 2.30, 'B1.5III', '#A5C3FF'),  -- Men (Alpha Lup)
  ('HIP-73273', 224.4754, -43.1336, 2.68, 'B2III', '#A5C3FF'),  -- Kekouan (Beta Lup)
  ('HIP-75141', 230.3012, -41.1711, 2.80, 'B2IV', '#A5C3FF'),  -- Gamma Lup
  ('HIP-82273', 252.1658, -69.0289, 1.91, 'K2II', '#FFD2A1'),  -- Atria (Alpha TrA)
  ('HIP-77952', 238.6475, -63.4289, 2.83, 'F2III', '#F8F9FB'),  -- Beta TrA
  ('HIP-74971', 229.8083, -68.6806, 2.87, 'A1V', '#DCE6FF'),  -- Gamma TrA
  ('HIP-100751', 306.4117, -56.7350, 1.94, 'B2IV', '#A5C3FF'),  -- Peacock (Alpha Pav)
  ('HIP-101909', 310.2246, -66.2039, 3.42, 'A7III', '#DCE6FF'),  -- Beta Pav
  ('HIP-110130', 334.7088, -60.2597, 2.87, 'K3III', '#FFD2A1'),  -- Alpha Tuc
  ('HIP-111406', 338.8358, -62.4842, 4.36, 'B9V', '#A5C3FF'),  -- Beta1 Tuc
  ('HIP-10064',  32.4171,  34.9872, 3.00, 'A5III', '#DCE6FF'),  -- Mothallah (Alpha Tri)
  ('HIP-10670',  34.3946,  34.9875, 4.00, 'F6IV', '#F8F9FB'),  -- Beta Tri
  ('HIP-61585', 189.4754, -69.1350, 2.69, 'B2IV', '#A5C3FF'),  -- Alpha Mus
  ('HIP-62322', 191.6888, -68.1103, 3.04, 'B2V', '#A5C3FF'),  -- Beta Mus
  ('HIP-40793', 124.9658, -70.4967, 3.77, 'K0III', '#FFD2A1'),  -- Alpha Vol
  ('HIP-41312', 126.8375, -66.3931, 3.60, 'K2III', '#FFD2A1'),  -- Gamma2 Vol
  ('HIP-42911', 131.1762, -55.0000, 3.93, 'B9V', '#A5C3FF'),  -- Beta Vol
  ('HIP-21281',  68.4283, -55.0450, 3.30, 'A0III', '#DCE6FF'),  -- Alpha Dor
  ('HIP-30867',  97.4325,  -9.5500, 3.94, 'K0III', '#FFD2A1'),  -- Alpha Mon
  ('HIP-31292',  98.6367,  -7.0328, 4.60, 'B3V', '#A5C3FF'),  -- Beta Mon
  ('HIP-43409', 132.6108, -35.3083, 3.97, 'G5II', '#FFECC3'),  -- Beta Pyx
  ('HIP-49204', 150.7067, -58.7497, 3.42, 'B3V', '#A5C3FF'),  -- Chi Car
  ('HIP-48926', 149.8825, -58.7497, 3.82, 'B8II', '#A5C3FF'),  -- l Carinae
  ('HIP-54136', 166.1950, -62.3167, 3.84, 'A0V', '#DCE6FF'),  -- b1 Carinae
  ('HIP-63005', 193.6658, -48.5422, 3.85, 'B3V', '#A5C3FF'),  -- Nu Cen
  ('HIP-66657', 205.1054, -42.1008, 3.90, 'K3III', '#FFD2A1'),  -- Phi Cen
  ('HIP-61932', 190.3958, -36.7117, 3.91, 'B8V', '#A5C3FF'),  -- Tau Cen
  ('HIP-12770',  41.0183,  42.5786, 4.22, 'B9V', '#A5C3FF'),  -- Iota Per
  ('HIP-16340',  52.6158,  41.3400, 4.14, 'G4III', '#FFECC3'),  -- Eta Per
  ('HIP-14819',  47.7858,  38.3197, 4.31, 'B7V', '#A5C3FF'),  -- Theta Per
  ('HIP-20648',  66.3983,  38.3475, 4.06, 'B9V', '#A5C3FF'),  -- Psi Per
  ('HIP-18246',  58.5375,  34.6194, 4.25, 'B8V', '#A5C3FF'),  -- Omega Per
  ('HIP-22112',  71.0754,  41.1378, 4.50, 'A0V', '#DCE6FF'),  -- 53 Per
  ('HIP-22783',  73.1812,  66.3422, 4.03, 'B9III', '#A5C3FF'),  -- Beta Cam
  ('HIP-23296',  74.8329,  60.4411, 4.29, 'O9.5Ia', '#8AABFF'),  -- Alpha Cam
  ('HIP-36377', 112.5746,  69.1639, 4.76, 'M2III', '#FF8F35'),  -- 7 Cam
  ('HIP-46733', 142.9238,  34.3978, 3.13, 'K7III', '#FFD2A1'),  -- Alpha Lyn
  ('HIP-45860', 140.2312,  36.9686, 4.44, 'B9.5V', '#A5C3FF'),  -- 38 Lyn
  ('HIP-51384', 157.8504,  34.2147, 4.21, 'A3V', '#DCE6FF'),  -- Praecipua (46 LMi)
  ('HIP-50371', 154.3404,  36.7094, 4.41, 'G8III', '#FFECC3'),  -- Beta LMi
  ('HIP-64241', 197.6183,  17.5283, 4.26, 'F5V', '#F8F9FB'),  -- Diadem (Alpha Com)
  ('HIP-64394', 198.1154,  27.8767, 4.26, 'G0V', '#FFECC3'),  -- Beta Com
  ('HIP-59720', 183.6708,  28.2675, 4.35, 'K1III', '#FFD2A1'),  -- Gamma Com
  ('HIP-63125', 193.9929,  38.3183, 2.90, 'A0p', '#DCE6FF'),  -- Cor Caroli (Alpha2 CVn)
  ('HIP-61317', 188.5862,  41.3564, 4.26, 'G0V', '#FFECC3'),  -- Chara (Beta CVn)
  ('HIP-63121', 193.9808,  38.3167, 5.60, 'F0V', '#F8F9FB'),  -- Alpha1 CVn
  ('HIP-69373', 212.9808,  30.3703, 4.54, 'G8III', '#FFECC3'),  -- Tau Boo
  ('HIP-70327', 216.0358,  19.1022, 4.75, 'A1V', '#DCE6FF'),  -- Upsilon Boo
  ('HIP-76041', 232.8942,  10.9631, 4.06, 'F7V', '#F8F9FB'),  -- Theta Boo (Asellus Primus)
  ('HIP-71284', 218.6658,  25.0903, 4.47, 'F6IV', '#F8F9FB'),  -- Iota Boo (Asellus Secundus)
  ('HIP-70755', 217.3604,  25.1053, 4.54, 'K3III', '#FFD2A1'),  -- Kappa2 Boo (Asellus Tertius)
  ('HIP-77257', 236.4808,   6.4256, 2.63, 'K2III', '#FFD2A1'),  -- Unukalhai (Alpha Ser)
  ('HIP-77622', 236.9408,  15.4361, 3.65, 'A3V', '#DCE6FF'),  -- Beta Ser
  ('HIP-78072', 238.3308,  15.6606, 3.85, 'F6V', '#F8F9FB'),  -- Gamma Ser
  ('HIP-76276', 233.7088,  10.5397, 3.80, 'F0IV', '#F8F9FB'),  -- Delta Ser
  ('HIP-86496', 265.1762, -12.8711, 3.52, 'K0III', '#FFD2A1'),  -- Eta Ser
  ('HIP-89962', 275.4679,  -2.9389, 4.62, 'A2V', '#DCE6FF'),  -- Theta1 Ser (Alya)
  ('HIP-92175', 281.9967,  -8.2433, 3.85, 'K2III', '#FFD2A1'),  -- Ionnina (Alpha Sct)
  ('HIP-92814', 283.7437,  -4.7478, 4.22, 'G4II', '#FFECC3'),  -- Beta Sct
  ('HIP-96757', 295.6562,  17.8189, 4.37, 'G1II', '#FFECC3'),  -- Sham (Alpha Sge)
  ('HIP-96837', 295.7725,  17.4764, 4.38, 'G8III', '#FFECC3'),  -- Beta Sge
  ('HIP-98066', 298.8821,  19.4939, 3.51, 'M0III', '#FF8F35'),  -- Gamma Sge
  ('HIP-95771', 292.2908,  24.6644, 4.44, 'M0III', '#FF8F35'),  -- Anser (Alpha Vul)
  ('HIP-104987', 319.0433,   5.2494, 3.92, 'G0III', '#FFECC3'),  -- Kitalpha (Alpha Equ)
  ('HIP-104858', 318.5288,   6.8122, 4.16, 'F7V', '#F8F9FB'),  -- Delta Equ
  ('HIP-101958', 309.9242,  15.8978, 3.77, 'B9V', '#A5C3FF'),  -- Sualocin (Alpha Del)
  ('HIP-101769', 309.7342,  14.5936, 3.63, 'F5III', '#F8F9FB'),  -- Rotanev (Beta Del)
  ('HIP-102532', 312.0833,  16.1233, 3.87, 'K1IV', '#FFD2A1'),  -- Gamma2 Del
  ('HIP-102070', 310.2337,  15.0744, 4.43, 'A7V', '#DCE6FF'),  -- Delta Del
  ('HIP-101421', 308.8358,  11.3047, 4.03, 'B6III', '#A5C3FF'),  -- Aldulfin (Epsilon Del)
  ('HIP-111169', 337.8208,  50.2825, 3.77, 'A1V', '#DCE6FF'),  -- Alpha Lac
  ('HIP-110778', 337.1083,  52.2272, 4.43, 'G8III', '#FFECC3'),  -- Beta Lac
  ('HIP-104887', 318.7300,  51.7275, 4.74, 'B3IV', '#A5C3FF'),  -- Nu Cyg
  ('HIP-99848', 303.8821,  34.8986, 4.86, 'B9V', '#A5C3FF'),  -- 27 Cyg
  ('HIP-104925', 318.7846,  36.4883, 4.90, 'K2III', '#FFD2A1'),  -- 41 Cyg
  ('HIP-98337', 299.7612,  38.0006, 5.10, 'B8V', '#A5C3FF'),  -- 17 Cyg
  ('HIP-1368',   4.2988,  53.9008, 4.88, 'A5V', '#DCE6FF'),  -- Kappa Cas
  ('HIP-2949',   9.3804,  54.5222, 5.08, 'B5V', '#A5C3FF'),  -- Mu Cas
  ('HIP-3330',  10.6096,  50.7225, 5.17, 'G5V', '#FFECC3'),  -- Nu Cas
  ('HIP-4151',  13.3100,  58.2197, 5.25, 'K1III', '#FFD2A1'),  -- Xi Cas
  ('HIP-16228',  52.2608,  48.0642, 4.81, 'F4V', '#F8F9FB'),  -- Nu Per
  ('HIP-13849',  44.5908,  45.4183, 4.89, 'A3V', '#DCE6FF'),  -- 24 Per
  ('HIP-15204',  49.0062,  42.9158, 5.04, 'B8V', '#A5C3FF'),  -- 29 Per
  ('HIP-16989',  54.6712,  42.3683, 5.15, 'K0III', '#FFD2A1'),  -- 34 Per
  ('HIP-24879',  79.8804,  39.1486, 4.71, 'K0III', '#FFD2A1'),  -- Nu Aur
  ('HIP-27673',  87.7779,  37.3083, 4.88, 'K5III', '#FFD2A1'),  -- Pi Aur
  ('HIP-25114',  80.5900,  45.9350, 5.02, 'F8V', '#F8F9FB'),  -- Lambda Aur
  ('HIP-26450',  83.3217,  32.7003, 5.22, 'A2V', '#DCE6FF'),  -- 16 Aur
  ('HIP-17847',  57.3408,  24.4672, 5.46, 'B8V', '#A5C3FF'),  -- Pleione (BU Tau)
  ('HIP-17489',  56.1775,  24.4697, 5.44, 'B8V', '#A5C3FF'),  -- Taygeta (19 Tau)
  ('HIP-17531',  56.3262,  24.5539, 5.64, 'B9V', '#A5C3FF'),  -- Celaeno (16 Tau)
  ('HIP-17527',  56.3146,  24.1483, 5.76, 'B8V', '#A5C3FF'),  -- Asterope (21 Tau)
  ('HIP-21152',  68.0417,  15.9614, 4.28, 'A7V', '#DCE6FF'),  -- Cleeia (Delta3 Tau)
  ('HIP-21683',  69.8008,  15.8694, 4.65, 'K2III', '#FFD2A1'),  -- Secunda Hyadum (Theta2 Tau)
  ('HIP-21673',  69.7675,  15.9525, 3.84, 'A7III', '#DCE6FF'),  -- Theta1 Tau
  ('HIP-33827', 104.9904,  27.7981, 4.15, 'G8III', '#FFECC3'),  -- Iota Gem
  ('HIP-36393', 112.6312,  27.7981, 4.89, 'K1III', '#FFD2A1'),  -- Upsilon Gem
  ('HIP-35350', 109.5262,  26.8906, 5.01, 'A3V', '#DCE6FF'),  -- Phi Gem
  ('HIP-31554',  99.0412,  23.1114, 5.18, 'K0III', '#FFD2A1'),  -- Nu Gem
  ('HIP-43103', 132.3367,  11.8572, 4.25, 'A1V', '#DCE6FF'),  -- Acubens (Alpha Cnc)
  ('HIP-40526', 124.1604,   9.1856, 3.52, 'K4III', '#FFD2A1'),  -- Tarf (Beta Cnc)
  ('HIP-42806', 131.3975,  21.4683, 4.66, 'A1V', '#DCE6FF'),  -- Asellus Borealis (Gamma Cnc)
  ('HIP-42402', 129.8008,  17.6444, 4.66, 'F8V', '#F8F9FB'),  -- Meleph (Epsilon Cnc / Praesepe)
  ('HIP-49593', 151.8679,  13.9167, 4.47, 'F2III', '#F8F9FB'),  -- Eta Leo
  ('HIP-51624', 158.6275,  22.9686, 4.50, 'A2V', '#DCE6FF'),  -- Nu Leo
  ('HIP-54449', 175.9221,  12.3533, 5.09, 'G5III', '#FFECC3'),  -- Chi Leo
  ('HIP-55642', 179.6208,  13.3100, 5.26, 'A2V', '#DCE6FF'),  -- 72 Leo
  ('HIP-68520', 210.3604,   3.4000, 4.90, 'G8III', '#FFECC3'),  -- 70 Vir
  ('HIP-65241', 200.5829,  -3.3986, 4.97, 'K2III', '#FFD2A1'),  -- 89 Vir
  ('HIP-67275', 206.8208,  10.3347, 5.12, 'M1III', '#FF8F35'),  -- 109 Vir
  ('HIP-73620', 225.6417, -16.7117, 5.15, 'F5V', '#F8F9FB'),  -- 48 Lib
  ('HIP-74835', 229.4125, -28.4719, 5.30, 'K0III', '#FFD2A1'),  -- 37 Lib
  ('HIP-80112', 245.4125, -29.2158, 3.62, 'B2V', '#A5C3FF'),  -- Sigma Sco (Alniyat)
  ('HIP-81266', 248.9721, -28.2158, 2.82, 'B0V', '#A5C3FF'),  -- Tau Sco (Paikauhale)
  ('HIP-87073', 266.8604, -40.1258, 3.32, 'G8III', '#FFECC3'),  -- G Sco (Fuyue)
  ('HIP-82729', 253.6408, -38.0189, 3.54, 'K0III', '#FFD2A1'),  -- N Sco
  ('HIP-84380', 258.7454, -43.2386, 3.62, 'K2III', '#FFD2A1'),  -- Q Sco
  ('HIP-88771', 271.8604, -27.7083, 3.51, 'K1III', '#FFD2A1'),  -- Eta Sgr
  ('HIP-90887', 278.1154, -21.1114, 3.84, 'M2III', '#FF8F35'),  -- Polis (Mu Sgr)
  ('HIP-92027', 281.5604, -27.1008, 3.77, 'K0III', '#FFD2A1'),  -- Xi2 Sgr
  ('HIP-93085', 284.5208, -21.7822, 3.84, 'F3V', '#F8F9FB'),  -- Omicron Sgr
  ('HIP-96406', 294.6854, -42.1444, 4.53, 'G5III', '#FFECC3'),  -- Alpha Sgr B
  ('HIP-94527', 289.0417, -22.4139, 4.86, 'A2V', '#DCE6FF'),  -- 52 Sgr
  ('HIP-101452', 308.8821, -15.0833, 4.12, 'B9.5V', '#A5C3FF'),  -- Nu Cap
  ('HIP-103413', 314.7808, -17.2306, 4.28, 'B9.5V', '#A5C3FF'),  -- Rho Cap
  ('HIP-105294', 320.0054, -17.1444, 4.77, 'A0V', '#DCE6FF'),  -- Pi Cap
  ('HIP-106516', 323.7708, -21.2583, 5.10, 'F2V', '#F8F9FB'),  -- Tau Cap
  ('HIP-109492', 332.6958,  -7.8183, 4.69, 'A2V', '#DCE6FF'),  -- Eta Aqr
  ('HIP-111710', 339.9125, -14.2158, 4.70, 'B9.5V', '#A5C3FF'),  -- Lambda Aqr
  ('HIP-112961', 343.6842, -17.2306, 4.73, 'K1III', '#FFD2A1'),  -- Tau2 Aqr
  ('HIP-114341', 347.3821, -13.5828, 5.04, 'G8III', '#FFECC3'),  -- Phi Aqr
  ('HIP-116771', 355.0062,  -7.7000, 5.19, 'M1.5III', '#FF8F35'),  -- Psi1 Aqr
  ('HIP-7097',  22.8804,   7.5911, 4.28, 'K0III', '#FFD2A1'),  -- Epsilon Psc
  ('HIP-5799',  18.8958,   5.6239, 4.43, 'F7V', '#F8F9FB'),  -- Zeta Psc
  ('HIP-114996', 349.7762,   1.1008, 4.52, 'F4IV', '#F8F9FB'),  -- Iota Psc
  ('HIP-3885',  12.4842,  15.3458, 5.21, 'K4III', '#FFD2A1'),  -- Mu Psc
  ('HIP-10138',  32.6417,  27.2606, 5.48, 'G8III', '#FFECC3'),  -- Chi Psc
  ('HIP-81833', 250.8417, -18.4556, 3.20, 'A2V', '#DCE6FF'),  -- Epsilon Oph
  ('HIP-86284', 264.4446, -12.7667, 4.28, 'K0III', '#FFD2A1'),  -- Nu Oph
  ('HIP-88192', 270.0804,   9.5606, 4.44, 'F2V', '#F8F9FB'),  -- 67 Oph
  ('HIP-87585', 268.4125,   2.9842, 4.88, 'G5III', '#FFECC3'),  -- 72 Oph
  ('HIP-83431', 256.0958, -26.6000, 4.64, 'B3V', '#A5C3FF'),  -- Rho Oph
  ('HIP-80582', 246.7725,  17.0322, 4.41, 'A3IV', '#DCE6FF'),  -- Gamma Her
  ('HIP-81126', 248.5154,  37.2511, 4.60, 'A2V', '#DCE6FF'),  -- Theta Her
  ('HIP-85693', 262.6888,  33.7225, 4.82, 'K2III', '#FFD2A1'),  -- Tau Her
  ('HIP-91971', 281.1825,  36.9008, 4.36, 'M4.5III', '#FF8F35'),  -- R Lyr
  ('HIP-93225', 285.0658,  39.1444, 5.25, 'K0III', '#FFD2A1'),  -- Theta Lyr
  ('HIP-94114', 287.8208,  41.0506, 5.41, 'B9V', '#A5C3FF'),  -- Eta Lyr
  ('HIP-96291', 294.1083,  23.4183, 5.18, 'B8V', '#A5C3FF'),  -- 13 Vul
  ('HIP-99120', 301.9967,  27.8100, 5.30, 'K1III', '#FFD2A1'),  -- 23 Vul
  ('HIP-94141', 287.8958,   8.2433, 4.35, 'B3IV', '#A5C3FF'),  -- Iota Aql
  ('HIP-95168', 291.0062,  -7.0328, 4.96, 'B9V', '#A5C3FF'),  -- Lambda Aql
  ('HIP-97496', 297.2346,  11.8317, 5.12, 'A0V', '#DCE6FF'),  -- 62 Aql
  ('HIP-92689', 283.5604,  -9.5500, 4.88, 'K3III', '#FFD2A1'),  -- Gamma Sct
  ('HIP-91117', 278.8208,  -4.2158, 4.71, 'F2III', '#F8F9FB'),  -- Delta Sct (Prototype)
  ('HIP-112724', 342.6158,  44.3347, 4.53, 'B8V', '#A5C3FF'),  -- Kappa And
  ('HIP-11575',  37.3312,  40.5756, 4.82, 'A5V', '#DCE6FF'),  -- Upsilon And
  ('HIP-587',   1.8008,  38.4986, 5.04, 'K3III', '#FFD2A1'),  -- Lambda And
  ('HIP-168',   0.5217,  30.8610, 5.18, 'B9V', '#A5C3FF'),  -- 28 And
  ('HIP-4148',  13.2958,  46.4583, 5.27, 'A2V', '#DCE6FF'),  -- Pi And
  ('HIP-108706', 330.3408,  25.3444, 4.14, 'F5V', '#F8F9FB'),  -- Iota Peg
  ('HIP-111344', 338.4125,  23.5750, 4.20, 'F5V', '#F8F9FB'),  -- Kappa Peg
  ('HIP-112440', 341.7454,  12.1153, 4.41, 'G8III', '#FFECC3'),  -- Lambda Peg
  ('HIP-112748', 342.6888,  19.4183, 4.80, 'M3III', '#FF8F35'),  -- Psi Peg
  ('HIP-114144', 346.8004,  12.1889, 5.05, 'K1III', '#FFD2A1'),  -- Chi Peg
  ('HIP-9197',  29.5604, -10.3347, 4.07, 'B9.5V', '#A5C3FF'),  -- Eta Cet (Deneb Algenubi)
  ('HIP-12387',  39.8658, -15.2444, 4.18, 'K0III', '#FFD2A1'),  -- Theta Cet
  ('HIP-13642',  43.8821,   5.5906, 4.96, 'F7V', '#F8F9FB'),  -- Xi2 Cet
  ('HIP-15330',  49.4446,   8.7842, 5.17, 'B9V', '#A5C3FF'),  -- Nu Cet
  ('HIP-16244',  52.3125, -24.8100, 4.04, 'K1III', '#FFD2A1'),  -- Tau1 Eri
  ('HIP-18543',  59.5008, -23.6206, 4.25, 'K0III', '#FFD2A1'),  -- Tau5 Eri
  ('HIP-18907',  60.8417, -23.2486, 4.23, 'F3V', '#F8F9FB'),  -- Tau6 Eri
  ('HIP-14879',  48.3754, -37.1350, 4.27, 'F2V', '#F8F9FB'),  -- Chi Eri
  ('HIP-17797',  57.1762, -30.5600, 4.36, 'G8III', '#FFECC3'),  -- Upsilon2 Eri
  ('HIP-19587',  63.2604, -29.7583, 3.96, 'K0IV', '#FFD2A1'),  -- Upsilon4 Eri
  ('HIP-25859',  82.5604, -35.2800, 3.86, 'B8II', '#A5C3FF'),  -- Delta Col
  ('HIP-26338',  83.0804, -37.8906, 4.35, 'K1III', '#FFD2A1'),  -- Epsilon Col
  ('HIP-28567',  90.6258, -42.8222, 4.88, 'A2V', '#DCE6FF'),  -- Eta Col
  ('HIP-25281',  81.0804, -14.8100, 3.59, 'A1V', '#DCE6FF'),  -- Gamma Lep
  ('HIP-28103',  89.1458, -20.8767, 3.81, 'G8III', '#FFECC3'),  -- Delta Lep
  ('HIP-24305',  78.0062, -11.8500, 3.19, 'K4III', '#FFD2A1'),  -- Epsilon Lep
  ('HIP-24845',  79.7725, -16.2053, 3.55, 'A2V', '#DCE6FF'),  -- Zeta Lep
  ('HIP-32759', 102.6658, -19.2583, 3.83, 'K1III', '#FFD2A1'),  -- Omicron1 CMa
  ('HIP-33977', 106.1154, -23.8322, 3.96, 'B3Ia', '#A5C3FF'),  -- Omicron2 CMa
  ('HIP-33018', 103.4446, -24.1839, 4.12, 'K4III', '#FFD2A1'),  -- Pi CMa
  ('HIP-34714', 107.8208, -14.1839, 4.48, 'B3V', '#A5C3FF'),  -- Theta CMa
  ('HIP-35406', 109.6842, -26.7822, 4.82, 'F2V', '#F8F9FB'),  -- 10 CMa
  ('HIP-37036', 114.3408, -36.7822, 4.49, 'F6II', '#F8F9FB'),  -- Pi Pup
  ('HIP-39138', 120.0804, -39.1114, 4.65, 'F8V', '#F8F9FB'),  -- 1 Pup
  ('HIP-38160', 117.1825, -43.1444, 5.08, 'A0V', '#DCE6FF'),  -- 11 Pup
  ('HIP-43880', 134.1825, -46.0417, 3.84, 'B5V', '#A5C3FF'),  -- Phi Vel
  ('HIP-46853', 143.2604, -54.5683, 4.05, 'B6V', '#A5C3FF'),  -- Chi Vel
  ('HIP-48774', 149.3821, -56.0958, 4.38, 'K0III', '#FFD2A1'),  -- q Vel
  ('HIP-45080', 137.8958, -48.2444, 4.70, 'M2III', '#FF8F35'),  -- c Vel
  ('HIP-44382', 135.7454, -59.2583, 3.39, 'G6II', '#FFECC3'),  -- l Car
  ('HIP-51192', 157.0804, -62.4842, 3.82, 'B3V', '#A5C3FF'),  -- s Car
  ('HIP-51839', 159.1825, -66.7822, 3.96, 'A0V', '#DCE6FF'),  -- u Car
  ('HIP-53740', 164.8821, -63.4183, 4.34, 'K3III', '#FFD2A1'),  -- x Car
  ('HIP-47854', 146.2604, -64.1114, 4.62, 'F5Ia', '#F8F9FB'),  -- i Car
  ('HIP-60000', 184.2604, -60.4000, 4.02, 'B4V', '#A5C3FF'),  -- Mu Cru
  ('HIP-59747', 183.7454, -58.7497, 4.88, 'B5V', '#A5C3FF'),  -- Eta Cru
  ('HIP-67260', 206.7821, -39.1114, 3.41, 'B2IV', '#A5C3FF'),  -- d Cen
  ('HIP-65109', 200.1825, -32.4183, 3.86, 'K0III', '#FFD2A1'),  -- i Cen
  ('HIP-63938', 196.4804, -49.4183, 4.25, 'B8V', '#A5C3FF'),  -- k Cen
  ('HIP-67472', 207.3408, -53.2583, 4.30, 'B8V', '#A5C3FF'),  -- c1 Cen
  ('HIP-72769', 223.1825, -35.2583, 4.42, 'F5V', '#F8F9FB'),  -- y Cen
  ('HIP-74117', 227.2604, -40.5606, 3.37, 'B2IV', '#A5C3FF'),  -- Delta Lup
  ('HIP-75647', 231.7454, -44.6806, 3.41, 'B2IV', '#A5C3FF'),  -- Zeta Lup
  ('HIP-78384', 240.0417, -36.4183, 3.58, 'B3IV', '#A5C3FF'),  -- Eta Lup
  ('HIP-76001', 232.7821, -34.8806, 4.05, 'B2.5V', '#A5C3FF'),  -- Theta Lup
  ('HIP-71865', 220.5008, -37.1114, 4.22, 'F4IV', '#F8F9FB'),  -- Iota Lup
  ('HIP-92953', 284.1458, -37.9067, 4.11, 'A2V', '#DCE6FF'),  -- Alfecca Meridiana (Alpha CrA)
  ('HIP-93825', 286.8604, -39.3400, 4.11, 'K0II', '#FFD2A1'),  -- Beta CrA
  ('HIP-93449', 285.7454, -37.1114, 4.21, 'F8V', '#F8F9FB'),  -- Gamma CrA
  ('HIP-90568', 277.2604, -45.9683, 3.51, 'B3IV', '#A5C3FF'),  -- Alpha Tel
  ('HIP-86670', 265.6408, -56.3778, 2.85, 'K3III', '#FFD2A1'),  -- Choo (Beta Ara)
  ('HIP-85727', 262.7821, -49.8750, 2.84, 'B2Vne', '#A5C3FF'),  -- Alpha Ara
  ('HIP-86162', 264.1154, -46.3867, 3.34, 'B1Ib', '#A5C3FF'),  -- Zeta Ara
  ('HIP-85792', 262.9604, -60.6806, 3.66, 'K5III', '#FFD2A1'),  -- Gamma Ara
  ('HIP-80569', 246.7208, -45.1606, 4.02, 'G8III', '#FFECC3'),  -- Gamma2 Nor
  ('HIP-81265', 248.9683, -42.1444, 4.43, 'B4V', '#A5C3FF'),  -- Epsilon Nor
  ('HIP-101772', 309.7454, -47.2889, 3.11, 'K0III', '#FFD2A1'),  -- The Persian (Alpha Ind)
  ('HIP-103227', 314.2604, -58.4500, 3.65, 'K1II', '#FFD2A1'),  -- Beta Ind
  ('HIP-100298', 304.9804, -33.7822, 4.88, 'G8III', '#FFECC3'),  -- Alpha Mic
  ('HIP-110752', 336.9604, -43.4842, 3.99, 'G6III', '#FFECC3'),  -- Delta1 Gru
  ('HIP-2072',   6.6408, -46.7178, 3.41, 'K5III', '#FFD2A1'),  -- Gamma Phe
  ('HIP-270',   0.8821, -49.0739, 3.93, 'B6V', '#A5C3FF'),  -- Delta Phe
  ('HIP-118322', 359.8821, -45.7450, 3.88, 'K0III', '#FFD2A1'),  -- Epsilon Phe
  ('HIP-428',   1.3408, -29.3564, 4.30, 'B7III', '#A5C3FF'),  -- Alpha Scl
  ('HIP-116231', 353.4804, -37.8222, 4.38, 'B9.5V', '#A5C3FF'),  -- Beta Scl
  ('HIP-115830', 352.2604, -32.5422, 4.50, 'K1III', '#FFD2A1'),  -- Gamma Scl
  ('HIP-15125',  48.8208, -31.9400, 3.87, 'F8V', '#F8F9FB'),  -- Dalim (Alpha For)
  ('HIP-13147',  42.2604, -32.4000, 4.45, 'G8III', '#FFECC3'),  -- Beta For
  ('HIP-20175',  64.8604, -42.2956, 3.85, 'K1III', '#FFD2A1'),  -- Alpha Hor
  ('HIP-19747',  63.8208, -62.4842, 3.33, 'G7III', '#FFECC3'),  -- Alpha Ret
  ('HIP-18597',  59.7454, -64.8100, 3.84, 'K0IV', '#FFD2A1'),  -- Beta Ret
  ('HIP-32607', 102.1825, -61.9400, 3.27, 'A7IV', '#DCE6FF'),  -- Alpha Pic
  ('HIP-27321',  86.8208, -51.0667, 3.85, 'A6V', '#DCE6FF'),  -- Beta Pic (Famous Exoplanet)
  ('HIP-25606',  81.9604, -56.1656, 4.01, 'K1III', '#FFD2A1'),  -- Gamma Pic
  ('HIP-72370', 221.9604, -64.9750, 3.18, 'F1V', '#F8F9FB'),  -- Alpha Cir
  ('HIP-74824', 229.3821, -63.1444, 4.07, 'A3V', '#DCE6FF'),  -- Beta Cir
  ('HIP-72368', 221.9408, -79.0444, 3.83, 'K3III', '#FFD2A1'),  -- Alpha Aps
  ('HIP-60264', 185.0804, -72.1350, 3.84, 'B5V', '#A5C3FF'),  -- Gamma Mus
  ('HIP-63613', 195.5604, -71.5422, 3.61, 'K2III', '#FFD2A1'),  -- Delta Mus
  ('HIP-9236',  29.6804, -61.5700, 2.82, 'F0V', '#F8F9FB'),  -- Beta Hyi
  ('HIP-9582',  30.7454, -68.7822, 2.86, 'F0V', '#F8F9FB'),  -- Alpha Hyi
  ('HIP-18231',  58.4804, -74.2386, 3.26, 'M2III', '#FF8F35'),  -- Gamma Hyi
  ('HIP-29271',  92.8604, -74.9400, 5.08, 'G5V', '#FFECC3'),  -- Alpha Men
  ('HIP-7083',  22.7821, -82.4842, 4.28, 'G8III', '#FFECC3')  -- Beta Oct
ON CONFLICT (catalog_code) DO NOTHING;
