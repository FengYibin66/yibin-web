export interface GalleryImage {
  src: string
  caption: string
  year: string
  location: string
  /** width / height — drives corridor adaptive frames */
  aspect?: number
}

export interface GalleryRoom {
  id: string
  title: string
  subtitle: string
  year: string
  images: GalleryImage[]
}

export const galleryRooms: GalleryRoom[] = [
  {
    id: 'iceland',
    title: 'Iceland',
    subtitle: 'Land of Fire and Ice',
    year: '2023',
    images: [
      { src: '/gallery/iceland/iceland_2.jpg', caption: 'Northern Highlands', year: '2023', location: 'Iceland' },
      { src: '/gallery/iceland/iceland_3.jpg', caption: 'Volcanic Terrain', year: '2023', location: 'Iceland' },
      { src: '/gallery/iceland/iceland_4.jpg', caption: 'Arctic Light', year: '2023', location: 'Iceland' },
      { src: '/gallery/iceland/iceland_5.jpg', caption: 'The Open Road', year: '2023', location: 'Iceland' },
      { src: '/gallery/iceland/iceland_6.jpg', caption: 'Vast Plains', year: '2023', location: 'Iceland' },
      { src: '/gallery/iceland/iceland_7.jpg', caption: 'Glacier Waters', year: '2023', location: 'Iceland' },
      { src: '/gallery/iceland/iceland_8.jpg', caption: 'Mountain Pass', year: '2023', location: 'Iceland' },
      { src: '/gallery/iceland/iceland_9.jpg', caption: 'End of Day', year: '2023', location: 'Iceland' },
    ],
  },
  {
    id: 'paris',
    title: 'Paris',
    subtitle: 'La Ville Lumière',
    year: '2024',
    images: [
      { src: '/gallery/paris/Jardin du Palais Royal.jpg', caption: 'Jardin du Palais Royal', year: '2024', location: 'Paris, France' },
      { src: '/gallery/paris/Olympics, Paris.jpg', caption: 'Paris Olympics', year: '2024', location: 'Paris, France' },
      { src: '/gallery/paris/Palais Garnier_1.jpg', caption: 'Palais Garnier I', year: '2024', location: 'Paris, France' },
      { src: '/gallery/paris/Palais Garnier_2.jpg', caption: 'Palais Garnier II', year: '2024', location: 'Paris, France' },
      { src: '/gallery/paris/Palais Garnier_3.jpg', caption: 'Grand Foyer', year: '2024', location: 'Paris, France' },
      { src: '/gallery/paris/Palais Garnier_4.jpg', caption: 'The Stage', year: '2024', location: 'Paris, France' },
      { src: '/gallery/paris/Palais Garnier_5.jpg', caption: 'Golden Ceiling', year: '2024', location: 'Paris, France' },
      { src: '/gallery/paris/The_church.jpg', caption: 'Sacré-Cœur', year: '2024', location: 'Montmartre, Paris' },
      { src: '/gallery/paris/Tour_Effel.jpg', caption: 'La Tour Eiffel', year: '2024', location: 'Paris, France' },
      { src: '/gallery/paris/Tour_Effel_2.jpg', caption: 'Eiffel at Dusk', year: '2024', location: 'Paris, France' },
    ],
  },
  {
    id: 'imperial',
    title: 'Imperial College',
    subtitle: 'MSc General Structural Engineering',
    year: '2021–2022',
    images: [
      { src: '/gallery/imperial/QueensTower.jpg', caption: "Queen's Tower", year: '2021', location: 'Imperial College London' },
      { src: '/gallery/imperial/Royal_Albert_Hall.jpg', caption: 'Royal Albert Hall', year: '2022', location: 'South Kensington, London' },
      { src: '/gallery/imperial/SouthKingsinton.jpg', caption: 'South Kensington', year: '2021', location: 'London, UK' },
      { src: '/gallery/imperial/Natural_history_museum.jpg', caption: 'Natural History Museum', year: '2022', location: 'London, UK' },
      { src: '/gallery/imperial/graduation-ceremony-new.jpg', caption: 'Graduation Ceremony', year: '2022', location: 'Imperial College London', aspect: 4 / 3 },
      { src: '/gallery/imperial/graduate.jpg', caption: 'Graduation Day', year: '2022', location: 'Imperial College London' },
      { src: '/gallery/imperial/graduate2.jpg', caption: 'With Classmates', year: '2022', location: 'Imperial College London' },
      { src: '/gallery/imperial/graduate3.jpg', caption: 'Ceremony', year: '2022', location: 'Royal Albert Hall' },
      { src: '/gallery/imperial/graduate4.jpg', caption: 'Class of 2022', year: '2022', location: 'Imperial College London' },
      { src: '/gallery/imperial/group photo.jpg', caption: 'Research Group', year: '2022', location: 'London, UK' },
      { src: '/gallery/imperial/friends.jpg', caption: 'Friends', year: '2022', location: 'London, UK' },
    ],
  },
  {
    id: 'ai4sg',
    title: 'AI4SG Lab',
    subtitle: 'Research Student — NUS · AI for Social Good',
    year: '2023–2025',
    images: [
      {
        src: '/gallery/ai4sg/cscw-group.jpg',
        caption: 'CSCW with AI4SG',
        year: '2025',
        location: 'CSCW · Bergen, Norway',
        aspect: 4 / 3,
      },
    ],
  },
  {
    id: 'mcallister',
    title: 'McAllister',
    subtitle: 'Graduate Engineer — London team life',
    year: '2022–2023',
    images: [
      {
        src: '/gallery/mcallister/life/colleagues-new.jpg',
        caption: 'Team Dinner',
        year: '2023',
        location: 'London, UK',
        aspect: 4 / 3,
      },
      {
        src: '/gallery/mcallister/life/bros.jpg',
        caption: 'McAllister Bros',
        year: '2023',
        location: 'London, UK',
        aspect: 1,
      },
      {
        src: '/gallery/mcallister/life/colleagues.jpg',
        caption: 'With Colleagues',
        year: '2023',
        location: 'London, UK',
      },
      {
        src: '/gallery/mcallister/life/team.jpg',
        caption: 'Team Photo',
        year: '2023',
        location: 'London, UK',
      },
      {
        src: '/gallery/mcallister/life/afternoon-tea.jpg',
        caption: 'Afternoon Tea',
        year: '2023',
        location: 'London, UK',
      },
    ],
  },
  {
    id: 'life',
    title: 'Life',
    subtitle: 'People & moments along the way',
    year: '2022–2025',
    images: [
      {
        src: '/gallery/life/union.jpg',
        caption: 'The Union',
        year: '2023',
        location: 'London, UK',
        aspect: 3 / 4,
      },
      {
        src: '/gallery/life/beloved.jpg',
        caption: 'Beloved',
        year: '2024',
        location: '—',
        aspect: 1202 / 1600,
      },
      {
        src: '/gallery/life/family.jpg',
        caption: 'New Family',
        year: '2025',
        location: '—',
        aspect: 3 / 4,
      },
    ],
  },
  {
    id: 'kualalumpur',
    title: 'Kuala Lumpur',
    subtitle: 'University of Malaya Exchange',
    year: '2019–2020',
    images: [
      { src: '/gallery/um/Penang.jpg', caption: 'Penang Street Art', year: '2019', location: 'Penang, Malaysia' },
      { src: '/gallery/um/Cat.jpg', caption: 'Cat', year: '2019', location: 'Kuala Lumpur' },
      { src: '/gallery/um/UM_Friends_1.jpg', caption: 'University Friends', year: '2019', location: 'University of Malaya' },
      { src: '/gallery/um/UM_Friends_2.jpg', caption: 'Campus Life', year: '2020', location: 'University of Malaya' },
      { src: '/gallery/um/UM_Friends_3.jpg', caption: 'Together', year: '2020', location: 'Kuala Lumpur' },
      { src: '/gallery/um/UM_Friends_4.jpg', caption: 'Class of Exchange', year: '2020', location: 'University of Malaya' },
      { src: '/gallery/um/p7.jpg', caption: 'City Views', year: '2020', location: 'Kuala Lumpur' },
      { src: '/gallery/um/p8.jpg', caption: 'Exploration', year: '2020', location: 'Malaysia' },
    ],
  },
  {
    id: 'cornwall',
    title: 'Cornwall',
    subtitle: "Land's End",
    year: '2022',
    images: [
      { src: '/gallery/cornwall/St_Machell.jpg', caption: "St Michael's Mount", year: '2022', location: 'Cornwall, UK' },
      { src: '/gallery/cornwall/cornwall_1.jpg', caption: 'Coastal Path', year: '2022', location: 'Cornwall, UK' },
      { src: '/gallery/cornwall/cornwall_2.jpg', caption: 'Atlantic Shore', year: '2022', location: 'Cornwall, UK' },
      { src: '/gallery/cornwall/minack.jpg', caption: 'Minack Theatre', year: '2022', location: 'Porthcurno, Cornwall' },
      { src: '/gallery/cornwall/penzance_rainbow.jpg', caption: 'Rainbow over Penzance', year: '2022', location: 'Penzance, Cornwall' },
    ],
  },
  {
    id: 'hs2',
    title: 'HS2, London',
    subtitle: 'Structural Engineer — McAllistern Group',
    year: '2022–2023',
    images: [
      { src: '/gallery/hs2/under Euston Station.jpg', caption: 'Under Euston Station', year: '2023', location: 'London, UK' },
      { src: '/gallery/hs2/lining work as Oldfield Lane.jpg', caption: 'Lining Works, Oldfield Lane', year: '2023', location: 'London, UK' },
      { src: '/gallery/hs2/geospatial data collection.jpg', caption: 'Geospatial Survey', year: '2022', location: 'London, UK' },
      { src: '/gallery/hs2/me.jpg', caption: 'On Site', year: '2023', location: 'HS2 Construction Zone' },
      { src: '/gallery/hs2/work sniept.jpg', caption: 'Work in Progress', year: '2023', location: 'London, UK' },
    ],
  },
]
