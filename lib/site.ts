/**
 * Central place for brand content & links.
 * Replace the placeholder handles / numbers below with the real ones.
 */
export const site = {
  name: "BASST CUT",
  tagline: "HAIRCUT & STYLE",
  location: "ABRA, SIDON",
  country: "Lebanon",
  directionsUrl:
    "https://www.google.com/maps/search/?api=1&query=BASST+CUT+Abra+Sidon+Lebanon",
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/basstcut" },
    { label: "TikTok", href: "https://www.tiktok.com/@basstcut" },
    { label: "WhatsApp", href: "https://wa.me/961XXXXXXXX" },
  ],
};

export type Service = {
  name: string;
  description: string;
  /** Leave null to show the placeholder. e.g. "$10" */
  price: string | null;
  /** Optional photo in /public. When set, it replaces the SVG artwork. */
  image?: string;
  art: "haircut" | "fade" | "beard" | "combo" | "kids" | "styling";
};

export const services: Service[] = [
  { name: "HAIRCUT", description: "Shaped to your head, your face, your day.", price: null, art: "haircut" },
  { name: "FADE", description: "Seamless gradients, sharp at the edges.", price: null, art: "fade" },
  { name: "BEARD TRIM", description: "Clean lines. Hot towel. Balanced shape.", price: null, art: "beard" },
  { name: "HAIRCUT + BEARD", description: "The full reset, head to jaw.", price: null, art: "combo" },
  { name: "KIDS CUT", description: "Patient hands for the next generation.", price: null, art: "kids" },
  { name: "STYLING", description: "Texture, hold and finish for the night.", price: null, art: "styling" },
];
