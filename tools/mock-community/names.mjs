/* ============================================
   Mock community — name and place pools
   Used only by generate.mjs. Names are combined at
   random, so every person is invented; a combination
   can still match a real person by coincidence, as
   any common Filipino name would.

   Surnames deliberately include the shapes that
   break naive matching: particles (Dela Cruz, De los
   Santos), ñ (Peña), and very common names that
   produce homonyms.
   ============================================ */

export const SURNAMES_COMMON = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Castillo', 'Flores',
  'Villanueva', 'Ramos', 'Aquino', 'Navarro', 'Salazar', 'Mercado', 'Gonzales', 'Lopez', 'Hernandez', 'Perez',
  'Dela Cruz', 'De Guzman', 'Del Rosario', 'De Leon', 'De los Santos', 'De Vera', 'Dela Rosa', 'Delos Reyes', 'De Castro', 'Dela Pena',
];

export const SURNAMES_OTHER = [
  'Abad', 'Abella', 'Abrenica', 'Acosta', 'Adriano', 'Agbayani', 'Agcaoili', 'Aguilar', 'Aguinaldo', 'Alarcon',
  'Alba', 'Albano', 'Alcantara', 'Alcaraz', 'Alday', 'Alejandro', 'Alfonso', 'Almario', 'Almeda', 'Alonzo',
  'Alvarado', 'Alvarez', 'Amador', 'Amante', 'Ambrosio', 'Amores', 'Andaya', 'Andres', 'Angeles', 'Antonio',
  'Apostol', 'Aragon', 'Arceo', 'Arellano', 'Arevalo', 'Arguelles', 'Arias', 'Arroyo', 'Asuncion', 'Atienza',
  'Austria', 'Avila', 'Ayala', 'Baclig', 'Bacani', 'Baldonado', 'Balagtas', 'Balboa', 'Baluyot', 'Banaag',
  'Bañez', 'Barcelona', 'Barrera', 'Barrientos', 'Basilio', 'Batungbakal', 'Bello', 'Benitez', 'Bernardo', 'Bersamin',
  'Blanco', 'Bondoc', 'Bonifacio', 'Borja', 'Buenaventura', 'Bustamante', 'Caballero', 'Cabrera', 'Cabral', 'Cacho',
  'Calderon', 'Calma', 'Camacho', 'Campos', 'Canlas', 'Cañete', 'Capili', 'Carpio', 'Carreon', 'Carrillo',
  'Casimiro', 'Castañeda', 'Castro', 'Catapang', 'Cayabyab', 'Ceniza', 'Cervantes', 'Chavez', 'Chua', 'Cipriano',
  'Clemente', 'Co', 'Concepcion', 'Consolacion', 'Cordero', 'Coronel', 'Corpuz', 'Cortez', 'Cosico', 'Cunanan',
  'Dalisay', 'Dantes', 'Datu', 'David', 'Dayrit', 'Diaz', 'Dimaculangan', 'Dimagiba', 'Dimalanta', 'Dizon',
  'Domingo', 'Dominguez', 'Dungca', 'Duque', 'Durano', 'Enriquez', 'Escobar', 'Escueta', 'Espino', 'Espinosa',
  'Espiritu', 'Estrada', 'Estrella', 'Evangelista', 'Fabian', 'Fajardo', 'Faustino', 'Feliciano', 'Fernandez', 'Ferrer',
  'Fortuna', 'Francisco', 'Fuentes', 'Gabriel', 'Galang', 'Galvez', 'Gamboa', 'Gaspar', 'Gatdula', 'Gatchalian',
  'Gerona', 'Geronimo', 'Go', 'Gomez', 'Guanzon', 'Guevarra', 'Gutierrez', 'Guzman', 'Hilario', 'Ignacio',
  'Ilagan', 'Ilustre', 'Imperial', 'Inocencio', 'Javier', 'Jimenez', 'Joson', 'Jose', 'Lacson', 'Lagman',
  'Lansangan', 'Lapid', 'Laurel', 'Lazaro', 'Legaspi', 'Leonardo', 'Lim', 'Limjoco', 'Liwanag', 'Llamas',
  'Lozada', 'Lucero', 'Luna', 'Mabini', 'Macapagal', 'Macaraeg', 'Madrid', 'Magbanua', 'Magno', 'Magsaysay',
  'Malabanan', 'Malonzo', 'Mallari', 'Manalastas', 'Manalo', 'Manansala', 'Mangubat', 'Manuel', 'Marasigan', 'Marquez',
  'Martin', 'Martinez', 'Mateo', 'Matias', 'Maximo', 'Medina', 'Mejia', 'Melendez', 'Mendiola', 'Mesina',
  'Miranda', 'Molina', 'Monteverde', 'Montoya', 'Morales', 'Moreno', 'Muñoz', 'Nakpil', 'Natividad', 'Nepomuceno',
  'Nicolas', 'Nieva', 'Noble', 'Nolasco', 'Nuñez', 'Obrero', 'Olivares', 'Oliveros', 'Ong', 'Ordoñez',
  'Orense', 'Ortega', 'Ortiz', 'Osorio', 'Pacheco', 'Padilla', 'Pagdanganan', 'Palma', 'Pamintuan', 'Panganiban',
  'Pangilinan', 'Paras', 'Pascual', 'Pasion', 'Paterno', 'Pelayo', 'Peña', 'Peralta', 'Pineda', 'Pizarro',
  'Policarpio', 'Ponce', 'Puno', 'Punzalan', 'Quiambao', 'Quijano', 'Quimbo', 'Quintos', 'Quirino', 'Quizon',
  'Rafael', 'Ramirez', 'Rana', 'Rayos', 'Recto', 'Regalado', 'Resurreccion', 'Reynoso', 'Rivera', 'Rizal',
  'Robles', 'Rodriguez', 'Rojas', 'Rola', 'Roldan', 'Romero', 'Rosales', 'Rosario', 'Roxas', 'Rubio',
  'Ruiz', 'Sabado', 'Sacdalan', 'Salas', 'Salcedo', 'Salonga', 'Samonte', 'Samson', 'San Jose', 'San Juan',
  'San Pedro', 'Sanchez', 'Sandoval', 'Santiago', 'Santa Maria', 'Santillan', 'Sarmiento', 'Sebastian', 'Serrano', 'Sevilla',
  'Sicat', 'Silang', 'Silva', 'Simbulan', 'Soriano', 'Sotelo', 'Soto', 'Suarez', 'Sumulong', 'Sunga',
  'Sy', 'Tabora', 'Tagle', 'Talavera', 'Tamayo', 'Tan', 'Tanedo', 'Tanglao', 'Tapia', 'Tayag',
  'Tecson', 'Tejada', 'Tiangco', 'Timbol', 'Tiongson', 'Tolentino', 'Tomas', 'Tongco', 'Trinidad', 'Tuazon',
  'Tumang', 'Umali', 'Untalan', 'Uy', 'Valdez', 'Valencia', 'Valenzuela', 'Vargas', 'Velasco', 'Velasquez',
  'Venturina', 'Vera', 'Vergara', 'Victorino', 'Villa', 'Villafuerte', 'Villamor', 'Villar', 'Villareal', 'Villaruz',
  'Vinluan', 'Viray', 'Yabut', 'Yambao', 'Yap', 'Yu', 'Yulo', 'Zabala', 'Zamora', 'Zapanta', 'Zaragoza', 'Zulueta',
];

/* Given names by birth era: [ { until: birthYear, male: [...], female: [...] } ]. */
export const GIVEN_NAMES = [
  {
    until: 1949,
    male: ['Agapito', 'Alfonso', 'Anastacio', 'Andres', 'Antonio', 'Apolinario', 'Arsenio', 'Benigno', 'Bonifacio', 'Candido',
      'Catalino', 'Celestino', 'Cipriano', 'Clemente', 'Conrado', 'Crisanto', 'Crispin', 'Dominador', 'Eduardo', 'Eladio',
      'Emilio', 'Enrique', 'Epifanio', 'Ernesto', 'Eulogio', 'Eusebio', 'Fausto', 'Federico', 'Felipe', 'Felix',
      'Fernando', 'Florencio', 'Francisco', 'Gaudencio', 'Gregorio', 'Guillermo', 'Hermenegildo', 'Hilarion', 'Ignacio', 'Isidro',
      'Jacinto', 'Jose', 'Juan', 'Julian', 'Leandro', 'Leon', 'Leoncio', 'Lorenzo', 'Lucio', 'Macario',
      'Marcelino', 'Mariano', 'Mateo', 'Maximo', 'Melencio', 'Nicanor', 'Nicolas', 'Pablo', 'Pascual', 'Pedro',
      'Primitivo', 'Procopio', 'Rafael', 'Ramon', 'Roman', 'Rufino', 'Salvador', 'Santiago', 'Severino', 'Simeon',
      'Teodoro', 'Tiburcio', 'Tomas', 'Valentin', 'Vicente', 'Victorino', 'Zacarias'],
    female: ['Adelaida', 'Agripina', 'Amparo', 'Anastacia', 'Angelita', 'Antonia', 'Asuncion', 'Aurora', 'Basilia', 'Beatriz',
      'Candida', 'Carmen', 'Catalina', 'Cecilia', 'Celestina', 'Concepcion', 'Consolacion', 'Corazon', 'Crisanta', 'Dolores',
      'Dominga', 'Eduvigis', 'Elena', 'Encarnacion', 'Enriqueta', 'Epifania', 'Erlinda', 'Esperanza', 'Eufemia', 'Felicidad',
      'Felisa', 'Filomena', 'Florentina', 'Francisca', 'Gliceria', 'Gregoria', 'Guadalupe', 'Herminia', 'Hermogena', 'Ignacia',
      'Isabel', 'Josefa', 'Josefina', 'Juana', 'Leonora', 'Librada', 'Lourdes', 'Luisa', 'Luz', 'Magdalena',
      'Marcela', 'Margarita', 'Maria', 'Mercedes', 'Milagros', 'Natividad', 'Nieves', 'Pacita', 'Paz', 'Pelagia',
      'Perpetua', 'Petra', 'Pilar', 'Purificacion', 'Rebecca', 'Remedios', 'Rosario', 'Salud', 'Soledad', 'Teodora',
      'Trinidad', 'Valentina', 'Victoria', 'Vicenta', 'Virginia'],
  },
  {
    until: 1979,
    male: ['Alberto', 'Alfredo', 'Allan', 'Alvin', 'Arnel', 'Arnold', 'Armando', 'Arturo', 'Augusto', 'Benjamin',
      'Bernardo', 'Bienvenido', 'Carlos', 'Cesar', 'Danilo', 'Dante', 'Daniel', 'Dennis', 'Diosdado', 'Domingo',
      'Edgar', 'Edgardo', 'Edmundo', 'Edwin', 'Efren', 'Elmer', 'Emmanuel', 'Erwin', 'Ferdinand', 'Fernando',
      'Francis', 'Gerardo', 'Gilbert', 'Gregorio', 'Hector', 'Henry', 'Herminio', 'Jaime', 'Jesus', 'Joel',
      'Jonathan', 'Jose', 'Juan', 'Julius', 'Leonardo', 'Lito', 'Lorenzo', 'Manuel', 'Marcelo', 'Mario',
      'Marlon', 'Michael', 'Nestor', 'Noel', 'Oscar', 'Pedro', 'Raul', 'Renato', 'Reynaldo', 'Ricardo',
      'Rizalino', 'Robert', 'Roberto', 'Rodel', 'Rodolfo', 'Rodrigo', 'Rogelio', 'Rolando', 'Romeo', 'Ronaldo',
      'Rommel', 'Ruben', 'Salvador', 'Sergio', 'Teofilo', 'Vicente', 'Victor', 'Virgilio', 'Wilfredo', 'Willy'],
    female: ['Adoracion', 'Agnes', 'Aida', 'Alicia', 'Alma', 'Amelia', 'Ana', 'Anita', 'Annabelle', 'Araceli',
      'Arlene', 'Aurelia', 'Belen', 'Bernadette', 'Carolina', 'Carmelita', 'Catherine', 'Cecilia', 'Celia', 'Charito',
      'Clarita', 'Cristina', 'Cynthia', 'Daisy', 'Diana', 'Divina', 'Edna', 'Editha', 'Elisa', 'Elizabeth',
      'Elvira', 'Emily', 'Emma', 'Estrella', 'Evelyn', 'Fe', 'Flordeliza', 'Gemma', 'Gloria', 'Grace',
      'Helen', 'Imelda', 'Irene', 'Jocelyn', 'Josephine', 'Julieta', 'Leticia', 'Lilia', 'Liza', 'Lolita',
      'Lorna', 'Lourdes', 'Lucila', 'Lydia', 'Mae', 'Marilou', 'Maria', 'Maricel', 'Marites', 'Marissa',
      'Marivic', 'Maribel', 'Marlene', 'Mary Ann', 'Melinda', 'Merlinda', 'Myrna', 'Nancy', 'Natalia', 'Nelia',
      'Nenita', 'Norma', 'Nora', 'Ofelia', 'Perla', 'Primrose', 'Rebecca', 'Regina', 'Rosalinda', 'Rosemarie',
      'Rowena', 'Ruth', 'Sally', 'Sheila', 'Susan', 'Sylvia', 'Teresita', 'Thelma', 'Vilma', 'Violeta', 'Yolanda'],
  },
  {
    until: 2004,
    male: ['Aaron', 'Adrian', 'Alexander', 'Andrew', 'Angelo', 'Anthony', 'Arvin', 'Benedict', 'Bryan', 'Carlo',
      'Christian', 'Christopher', 'Daryl', 'Darwin', 'David', 'Dominic', 'Edison', 'Elijah', 'Emerson', 'Eric',
      'Francis', 'Gabriel', 'Gerald', 'Harold', 'Ian', 'Ivan', 'Jason', 'Jayson', 'Jeffrey', 'Jerome',
      'Jericho', 'Jhon', 'Joey', 'John', 'Jomar', 'Jordan', 'Joseph', 'Joshua', 'Justin', 'Kenneth',
      'Kevin', 'Kim', 'Lawrence', 'Leo', 'Louie', 'Marco', 'Mark', 'Martin', 'Matthew', 'Michael',
      'Miguel', 'Neil', 'Nathaniel', 'Patrick', 'Paul', 'Paolo', 'Philip', 'Raymond', 'Reymart', 'Richard',
      'Rico', 'Robin', 'Ryan', 'Sean', 'Stephen', 'Timothy', 'Vincent', 'Wesley', 'Zandro'],
    female: ['Abigail', 'Aileen', 'Alyssa', 'Ana', 'Andrea', 'Angela', 'Angelica', 'Anna', 'April', 'Ariane',
      'Bea', 'Bianca', 'Camille', 'Carla', 'Charmaine', 'Cherry', 'Christine', 'Clarisse', 'Claudine', 'Czarina',
      'Danica', 'Denise', 'Diane', 'Donna', 'Elaine', 'Erica', 'Faith', 'Frances', 'Gillian', 'Hannah',
      'Hazel', 'Ivy', 'Jamie', 'Janine', 'Jasmine', 'Jennifer', 'Jessica', 'Joanna', 'Joy', 'Joyce',
      'Judy Ann', 'Kaye', 'Kimberly', 'Kristine', 'Krizia', 'Lea', 'Liezel', 'Lovely', 'Lyka', 'Mae',
      'Maria', 'Marianne', 'Mary Grace', 'Mary Joy', 'Mary Rose', 'Michelle', 'Mikaela', 'Monica', 'Nicole', 'Patricia',
      'Pauline', 'Princess', 'Rachel', 'Rhea', 'Rica', 'Rochelle', 'Rose Ann', 'Sarah', 'Shaina', 'Sharmaine',
      'Sheryl', 'Stephanie', 'Thea', 'Trisha', 'Vanessa', 'Veronica', 'Yvonne'],
  },
  {
    until: 9999,
    male: ['Aiden', 'Andrei', 'Asher', 'Axel', 'Bryce', 'Caleb', 'Carl', 'Clark', 'Daniel', 'Dylan',
      'Elias', 'Enzo', 'Ethan', 'Evan', 'Ezekiel', 'Finn', 'Gabriel', 'Gian', 'Hans', 'Isaac',
      'Jacob', 'Jaden', 'James', 'Jared', 'Jeremiah', 'Jude', 'Julian', 'Kai', 'Kian', 'Kyle',
      'Lance', 'Liam', 'Lorenzo', 'Lucas', 'Luke', 'Marcus', 'Mateo', 'Maverick', 'Nathan', 'Noah',
      'Oliver', 'Owen', 'Raphael', 'Rafael', 'Rhys', 'Samuel', 'Santino', 'Sebastian', 'Theo', 'Thomas',
      'Tristan', 'Tyler', 'Xander', 'Zachary', 'Zion'],
    female: ['Aaliyah', 'Abby', 'Addison', 'Akira', 'Alexa', 'Althea', 'Amara', 'Amber', 'Amelia', 'Amihan',
      'Angel', 'Ashley', 'Athena', 'Aubrey', 'Audrey', 'Ayesha', 'Bella', 'Brielle', 'Celine', 'Chloe',
      'Claire', 'Elise', 'Ella', 'Emma', 'Erin', 'Eunice', 'Gabrielle', 'Hailey', 'Isabella', 'Isla',
      'Janelle', 'Kaia', 'Kate', 'Kathryn', 'Kiara', 'Kylie', 'Leah', 'Lily', 'Louise', 'Lucia',
      'Maia', 'Margaux', 'Mia', 'Mika', 'Naomi', 'Nathalie', 'Olivia', 'Precious', 'Rain', 'Reign',
      'Samantha', 'Sofia', 'Sophia', 'Stella', 'Summer', 'Tala', 'Tiffany', 'Yna', 'Zoe'],
  },
];

/* Second given names that form compounds ("Juan Carlos", "Maria Theresa"). */
export const COMPOUND = {
  male: { heads: ['Juan', 'Jose', 'John', 'Mark', 'Jan', 'Carlo', 'Joseph'],
    tails: ['Carlos', 'Miguel', 'Paolo', 'Antonio', 'Lorenzo', 'Rafael', 'Luis', 'Angelo', 'Gabriel', 'Mari'] },
  female: { heads: ['Maria', 'Mary', 'Ana', 'Rose', 'Anne', 'Maria'],
    tails: ['Theresa', 'Cristina', 'Lourdes', 'Clara', 'Isabel', 'Fe', 'Luisa', 'Angela', 'Corazon', 'Victoria'] },
};

/* Confirmation names picked for each sex, all present in saint-names.js. */
export const SAINT_NAMES = {
  male: ['Aloysius', 'Ambrose', 'Andrew', 'Anthony', 'Augustine', 'Benedict', 'Bernard', 'Charles', 'Christopher', 'Damian',
    'Dominic', 'Francis', 'Francis Xavier', 'Gabriel', 'George', 'Gregory', 'Ignatius', 'James', 'Jerome', 'John',
    'John Paul', 'Joseph', 'Jude', 'Lawrence', 'Leo', 'Luke', 'Mark', 'Martin', 'Matthew', 'Michael',
    'Padre Pio', 'Patrick', 'Paul', 'Peter', 'Raphael', 'Sebastian', 'Stephen', 'Thomas', 'Thomas Aquinas', 'Vincent de Paul'],
  female: ['Agatha', 'Agnes', 'Angela', 'Anne', 'Barbara', 'Bernadette', 'Bridget', 'Catherine', 'Cecilia', 'Clare',
    'Dorothy', 'Elizabeth', 'Faustina', 'Genevieve', 'Helena', 'Irene', 'Joan of Arc', 'Julia', 'Kateri', 'Lucy',
    'Margaret', 'Maria Goretti', 'Martha', 'Mary', 'Monica', 'Rita', 'Rose of Lima', 'Teresa of Avila', 'Therese of Lisieux', 'Veronica'],
};

/* Barangays around the parish, plus invented street names. */
export const BARANGAYS = ['Don Manuel', 'Doña Aurora', 'Doña Imelda', 'Doña Josefa', 'Santo Niño', 'Tatalon', 'San Isidro', 'Sienna', 'Lourdes', 'Maharlika', 'Salvacion', 'Paang Bundok', 'Santa Teresita', 'Manresa'];
export const STREETS = ['Sampaguita', 'Ilang-Ilang', 'Rosal', 'Camia', 'Dama de Noche', 'Katipunan Extension', 'Bayanihan', 'Pag-asa', 'Mabini Interior', 'Kalayaan Alley', 'Masipag', 'Matiyaga', 'Maligaya', 'Mapagmahal', 'Pilar', 'Mayon', 'Banahaw', 'Kanlaon', 'Apo', 'Malinta'];

/* Invented clergy. The real priests and bishop stay out of the mock registers. */
export const PRIESTS = [
  { name: 'Anselmo R. Dimaano', from: 1974, to: 1982 },
  { name: 'Teodulo B. Hizon', from: 1975, to: 1988 },
  { name: 'Rogaciano P. Sarmiento', from: 1982, to: 1993 },
  { name: 'Melchor D. Ybañez', from: 1986, to: 1999 },
  { name: 'Quintin L. Alcazar', from: 1993, to: 2004 },
  { name: 'Severo G. Mallonga', from: 1998, to: 2010 },
  { name: 'Lamberto C. Taruc', from: 2004, to: 2015 },
  { name: 'Hermes A. Vidallon', from: 2009, to: 2019 },
  { name: 'Prudencio M. Laxa', from: 2014, to: 2024 },
  { name: 'Eliseo T. Baltazar', from: 2019, to: 2026 },
  { name: 'Nazario V. Quiogue', from: 2022, to: 2026 },
];
export const BISHOPS = [
  { name: 'Gaudioso R. Almonte', from: 1974, to: 1989 },
  { name: 'Ildefonso C. Marcelo', from: 1989, to: 2003 },
  { name: 'Wenceslao P. Liboro', from: 2003, to: 2018 },
  { name: 'Ricaredo S. Tumbaga', from: 2018, to: 2026 },
];
export const CATECHISTS = ['Felicitas Quimpo', 'Rosita Hilado', 'Norberta Ledesma', 'Clarissa Oabel', 'Dionisia Banzon', 'Marilyn Sayoc', 'Teresa Abucay', 'Gemma Lualhati'];

export const OTHER_PARISHES = [
  'Holy Family Parish', 'Saint Joseph Parish', 'San Roque Parish', 'Immaculate Conception Parish', 'Santo Niño Parish',
  'Saint Michael Parish', 'Our Lady of Perpetual Help Parish', 'Saint John the Baptist Parish', 'San Isidro Labrador Parish', 'Saint Anthony of Padua Parish',
];
export const HOSPITALS = ['Quezon City General Hospital', 'St. Luke\'s Medical Center, Quezon City', 'East Avenue Medical Center', 'Philippine Heart Center', 'National Kidney and Transplant Institute'];
export const BURIAL_PLACES = ['Our Lady of Fatima Parish Columbarium', 'Manila Memorial Park', 'Himlayang Pilipino Memorial Park', 'Holy Cross Memorial Park', 'Bagbag Public Cemetery', 'Loyola Memorial Park'];
