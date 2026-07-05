export interface GalleryImage {
  src: string
  caption: string
  year: string
  location: string
}

export interface GalleryRoom {
  id: string
  title: string
  subtitle: string
  year: string
  images: GalleryImage[]
}

const BASE = 'https://raw.githubusercontent.com/FengYibin66/FengYibin66.github.io/main/'

export const galleryRooms: GalleryRoom[] = [
  {
    id: 'iceland',
    title: 'Iceland',
    subtitle: 'Land of Fire and Ice',
    year: '2023',
    images: [
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland.jpg', caption: 'Landscape', year: '2023', location: 'Iceland' },
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland_2.jpg', caption: 'Northern Highlands', year: '2023', location: 'Iceland' },
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland_3.jpg', caption: 'Volcanic Terrain', year: '2023', location: 'Iceland' },
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland_4.jpg', caption: 'Arctic Light', year: '2023', location: 'Iceland' },
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland_5.jpg', caption: 'The Open Road', year: '2023', location: 'Iceland' },
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland_6.jpg', caption: 'Vast Plains', year: '2023', location: 'Iceland' },
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland_7.jpg', caption: 'Glacier Waters', year: '2023', location: 'Iceland' },
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland_8.jpg', caption: 'Mountain Pass', year: '2023', location: 'Iceland' },
      { src: BASE + 'pictures/gallery/travel_life/Iceland/iceland_9.jpg', caption: 'End of Day', year: '2023', location: 'Iceland' },
    ],
  },
  {
    id: 'paris',
    title: 'Paris',
    subtitle: 'La Ville Lumière',
    year: '2024',
    images: [
      { src: BASE + 'pictures/gallery/travel_life/Paris/Jardin%20du%20Palais%20Royal.jpg', caption: 'Jardin du Palais Royal', year: '2024', location: 'Paris, France' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/Olympics%2C%20Paris.jpg', caption: 'Paris Olympics', year: '2024', location: 'Paris, France' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/Palais%20Garnier_1.jpg', caption: 'Palais Garnier I', year: '2024', location: 'Paris, France' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/Palais%20Garnier_2.jpg', caption: 'Palais Garnier II', year: '2024', location: 'Paris, France' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/Palais%20Garnier_3.jpg', caption: 'Grand Foyer', year: '2024', location: 'Paris, France' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/Palais%20Garnier_4.jpg', caption: 'The Stage', year: '2024', location: 'Paris, France' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/Palais%20Garnier_5.jpg', caption: 'Golden Ceiling', year: '2024', location: 'Paris, France' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/The_church.jpg', caption: 'Sacré-Cœur', year: '2024', location: 'Montmartre, Paris' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/Tour_Effel.jpg', caption: 'La Tour Eiffel', year: '2024', location: 'Paris, France' },
      { src: BASE + 'pictures/gallery/travel_life/Paris/Tour_Effel_2.jpg', caption: 'Eiffel at Dusk', year: '2024', location: 'Paris, France' },
    ],
  },
  {
    id: 'imperial',
    title: 'Imperial College',
    subtitle: 'MSc General Structural Engineering',
    year: '2021–2022',
    images: [
      { src: BASE + 'pictures/gallery/Imperial/QueensTower.jpg', caption: "Queen's Tower", year: '2021', location: 'Imperial College London' },
      { src: BASE + 'pictures/gallery/Imperial/Royal_Albert_Hall.jpg', caption: 'Royal Albert Hall', year: '2022', location: 'South Kensington, London' },
      { src: BASE + 'pictures/gallery/Imperial/SouthKingsinton.jpg', caption: 'South Kensington', year: '2021', location: 'London, UK' },
      { src: BASE + 'pictures/gallery/Imperial/Natural_history_museum.jpg', caption: 'Natural History Museum', year: '2022', location: 'London, UK' },
      { src: BASE + 'pictures/gallery/Imperial/graduate.jpg', caption: 'Graduation Day', year: '2022', location: 'Imperial College London' },
      { src: BASE + 'pictures/gallery/Imperial/graduate2.jpg', caption: 'With Classmates', year: '2022', location: 'Imperial College London' },
      { src: BASE + 'pictures/gallery/Imperial/graduate3.jpg', caption: 'Ceremony', year: '2022', location: 'Royal Albert Hall' },
      { src: BASE + 'pictures/gallery/Imperial/graduate4.jpg', caption: 'Class of 2022', year: '2022', location: 'Imperial College London' },
      { src: BASE + 'pictures/gallery/Imperial/group%20photo.jpg', caption: 'Research Group', year: '2022', location: 'London, UK' },
      { src: BASE + 'pictures/gallery/Imperial/friends.jpg', caption: 'Friends', year: '2022', location: 'London, UK' },
    ],
  },
  {
    id: 'kualalumpur',
    title: 'Kuala Lumpur',
    subtitle: 'University of Malaya Exchange',
    year: '2019–2020',
    images: [
      { src: BASE + 'pictures/gallery/UM/Penang.jpg', caption: 'Penang Street Art', year: '2019', location: 'Penang, Malaysia' },
      { src: BASE + 'pictures/gallery/UM/Cat.jpg', caption: 'Cat', year: '2019', location: 'Kuala Lumpur' },
      { src: BASE + 'pictures/gallery/UM/UM_Friends_1.jpg', caption: 'University Friends', year: '2019', location: 'University of Malaya' },
      { src: BASE + 'pictures/gallery/UM/UM_Friends_2.jpg', caption: 'Campus Life', year: '2020', location: 'University of Malaya' },
      { src: BASE + 'pictures/gallery/UM/UM_Friends_3.jpg', caption: 'Together', year: '2020', location: 'Kuala Lumpur' },
      { src: BASE + 'pictures/gallery/UM/UM_Friends_4.jpg', caption: 'Class of Exchange', year: '2020', location: 'University of Malaya' },
      { src: BASE + 'pictures/gallery/UM/p7.jpg', caption: 'City Views', year: '2020', location: 'Kuala Lumpur' },
      { src: BASE + 'pictures/gallery/UM/p8.jpg', caption: 'Exploration', year: '2020', location: 'Malaysia' },
    ],
  },
  {
    id: 'cornwall',
    title: 'Cornwall',
    subtitle: "Land's End",
    year: '2022',
    images: [
      { src: BASE + 'pictures/gallery/travel_life/Cornwall/St_Machell.jpg', caption: "St Michael's Mount", year: '2022', location: 'Cornwall, UK' },
      { src: BASE + 'pictures/gallery/travel_life/Cornwall/cornwall_1.jpg', caption: 'Coastal Path', year: '2022', location: 'Cornwall, UK' },
      { src: BASE + 'pictures/gallery/travel_life/Cornwall/cornwall_2.jpg', caption: 'Atlantic Shore', year: '2022', location: 'Cornwall, UK' },
      { src: BASE + 'pictures/gallery/travel_life/Cornwall/minack.jpg', caption: 'Minack Theatre', year: '2022', location: 'Porthcurno, Cornwall' },
      { src: BASE + 'pictures/gallery/travel_life/Cornwall/penzance_rainbow.jpg', caption: 'Rainbow over Penzance', year: '2022', location: 'Penzance, Cornwall' },
    ],
  },
  {
    id: 'hs2',
    title: 'HS2, London',
    subtitle: 'Structural Engineer — McAllistern Group',
    year: '2022–2023',
    images: [
      { src: BASE + 'pictures/pictures_for_work/mcallister_work/under%20Euston%20Station.jpg', caption: 'Under Euston Station', year: '2023', location: 'London, UK' },
      { src: BASE + 'pictures/pictures_for_work/mcallister_work/lining%20work%20as%20Oldfield%20Lane.jpg', caption: 'Lining Works, Oldfield Lane', year: '2023', location: 'London, UK' },
      { src: BASE + 'pictures/pictures_for_work/mcallister_work/geospatial%20data%20collection.jpg', caption: 'Geospatial Survey', year: '2022', location: 'London, UK' },
      { src: BASE + 'pictures/pictures_for_work/mcallister_work/me.jpg', caption: 'On Site', year: '2023', location: 'HS2 Construction Zone' },
      { src: BASE + 'pictures/pictures_for_work/mcallister_work/work%20sniept.jpg', caption: 'Work in Progress', year: '2023', location: 'London, UK' },
    ],
  },
]
