import { sql } from "drizzle-orm";
import {
  customerActivitiesTable,
  customerContactsTable,
  db,
  pool,
  collaborativeTasksTable,
  customersTable,
  invoicesTable,
  orderItemsTable,
  ordersTable,
  posterPostsTable,
  posterPostTargetsTable,
  productsTable,
  promotionProductsTable,
  promotionsTable,
  salesRepsTable,
  supplyInventoryCostingTable,
  supplyActivityEventsTable,
  supplyInventoryMovementsTable,
  supplyProcurementShipmentsTable,
  supplyPurchaseOrderLinesTable,
  supplyPurchaseOrdersTable,
  supplyReceiptLinesTable,
  supplyReceiptsTable,
  supplyShipmentLinesTable,
  supplyVendorBillsTable,
  supplyShipmentsTable,
  supplyVendorsTable,
  taskAssignmentsTable,
  usersTable,
} from "@workspace/db";

type SalesRepRow = typeof salesRepsTable.$inferInsert;
type ProductRow = typeof productsTable.$inferInsert;
type CustomerRow = typeof customersTable.$inferInsert;
type CustomerContactRow = typeof customerContactsTable.$inferInsert;
type CustomerActivityRow = typeof customerActivitiesTable.$inferInsert;
type PromotionRow = typeof promotionsTable.$inferInsert;
type InvoiceRow = typeof invoicesTable.$inferInsert;
type OrderItemRow = typeof orderItemsTable.$inferInsert;
type CollaborativeTaskRow = typeof collaborativeTasksTable.$inferInsert;
type SupplyVendorRow = typeof supplyVendorsTable.$inferInsert;
type SupplyShipmentRow = typeof supplyShipmentsTable.$inferInsert;
type SupplyInventoryCostingRow =
  typeof supplyInventoryCostingTable.$inferInsert;
type PosterPostRow = typeof posterPostsTable.$inferInsert;
type ProductRecord = typeof productsTable.$inferSelect;
type CustomerRecord = typeof customersTable.$inferSelect;
type SalesRepRecord = typeof salesRepsTable.$inferSelect;
type CatalogSeedRow = {
  category: string;
  sku: string;
  description: string;
  packSize: string;
  unitPrice: string;
};

const REP_COUNT = 12;
const CUSTOMER_COUNT = 140;
const PROMOTION_COUNT = 12;

const rng = mulberry32(0xc1ea5eed);

const firstNames = [
  "Ava",
  "Ben",
  "Chloe",
  "Diego",
  "Eleanor",
  "Finn",
  "Grace",
  "Hugo",
  "Iris",
  "Jack",
  "Kara",
  "Leo",
  "Maya",
  "Noah",
  "Opal",
  "Priya",
  "Quinn",
  "Rory",
  "Sage",
  "Tessa",
  "Uma",
  "Vince",
  "Wren",
  "Zoe",
];

const lastNames = [
  "Adams",
  "Bennett",
  "Carter",
  "Diaz",
  "Ellis",
  "Foster",
  "Garcia",
  "Hayes",
  "Iverson",
  "Jordan",
  "King",
  "Lopez",
  "Morgan",
  "Nguyen",
  "Owens",
  "Patel",
  "Quinn",
  "Reed",
  "Stone",
  "Turner",
  "Underwood",
  "Vega",
  "Ward",
  "Young",
];

const companyPrefixes = [
  "Apex",
  "Bluebird",
  "Crest",
  "Delta",
  "Evergreen",
  "Frontier",
  "Granite",
  "Harbor",
  "Ion",
  "Juniper",
  "Keystone",
  "Latitude",
  "Monarch",
  "Northstar",
  "Oakline",
  "Pioneer",
  "Quarry",
  "Redwood",
  "Summit",
  "Trailhead",
  "Unity",
  "Valley",
  "Westward",
  "Zenith",
];

const companySuffixes = [
  "Supply",
  "Industries",
  "Partners",
  "Trading",
  "Solutions",
  "Goods",
  "Systems",
  "Works",
];

const companyDescriptors = [
  "Collective",
  "Distribution",
  "Group",
  "Holdings",
  "Logistics",
  "Network",
  "Procurement",
  "Retail",
  "Wholesale",
];

const companyMarkets = [
  "Diagnostics",
  "Clinical Supply",
  "Medical Distribution",
  "Physician Services",
  "Point-of-Care",
  "Lab Essentials",
  "Screening Supply",
  "Women's Health",
  "Acute Care",
  "Occupational Health",
];

const companyCities = [
  { city: "Atlanta", state: "GA" },
  { city: "Austin", state: "TX" },
  { city: "Baltimore", state: "MD" },
  { city: "Birmingham", state: "AL" },
  { city: "Boise", state: "ID" },
  { city: "Charlotte", state: "NC" },
  { city: "Cincinnati", state: "OH" },
  { city: "Cleveland", state: "OH" },
  { city: "Columbus", state: "OH" },
  { city: "Denver", state: "CO" },
  { city: "Detroit", state: "MI" },
  { city: "Fort Worth", state: "TX" },
  { city: "Grand Rapids", state: "MI" },
  { city: "Houston", state: "TX" },
  { city: "Indianapolis", state: "IN" },
  { city: "Jacksonville", state: "FL" },
  { city: "Kansas City", state: "MO" },
  { city: "Knoxville", state: "TN" },
  { city: "Louisville", state: "KY" },
  { city: "Memphis", state: "TN" },
  { city: "Milwaukee", state: "WI" },
  { city: "Minneapolis", state: "MN" },
  { city: "Nashville", state: "TN" },
  { city: "Oklahoma City", state: "OK" },
  { city: "Omaha", state: "NE" },
  { city: "Orlando", state: "FL" },
  { city: "Phoenix", state: "AZ" },
  { city: "Pittsburgh", state: "PA" },
  { city: "Raleigh", state: "NC" },
  { city: "Richmond", state: "VA" },
  { city: "Sacramento", state: "CA" },
  { city: "Salt Lake City", state: "UT" },
  { city: "San Antonio", state: "TX" },
  { city: "St. Louis", state: "MO" },
  { city: "Tampa", state: "FL" },
];

const promoNames = [
  "New Year Momentum",
  "Spring Ramp",
  "Midyear Push",
  "Summer Launch",
  "Back Half Accelerator",
  "Year-End Closeout",
  "Q1 Foundation",
  "June Surge",
  "Peak Season Prep",
];

const shippingMethods = ["Ground", "Two-Day", "Overnight", "Freight"];
const orderStatuses = ["open", "in_transit", "fulfilled", "cancelled"] as const;
const termsOptions = ["Net 15", "Net 30", "Net 45", "Due on receipt"];
const customerStatuses = ["active", "prospect", "on_hold", "inactive"] as const;
const contactTitles = [
  "Purchasing Manager",
  "Operations Lead",
  "Accounts Payable",
  "Warehouse Supervisor",
];
const noteTemplates = [
  "Discussed seasonal replenishment and confirmed current forecast assumptions.",
  "Customer requested more visibility into lead times for core SKUs.",
  "Shared revised pricing guidance for next quarter programs.",
  "Reviewed open balance and agreed on payment timing for remaining invoices.",
];
const callOutcomes = [
  "Left voicemail",
  "Reached customer",
  "Awaiting customer reply",
  "Confirmed next step",
];
const meetingNotes = [
  "Quarterly business review focused on open orders, service level targets, and category expansion.",
  "Walked through assortment recommendations and next promotional window.",
  "Aligned on launch timing for new SKUs and warehouse receiving constraints.",
];
const emailSubjects = [
  "Sent order status recap",
  "Shared invoice copy and remittance details",
  "Followed up on category expansion proposal",
];

const catalogSeedRows: CatalogSeedRow[] = [
  {
    category: "UA Platinum",
    sku: "CLA-10P",
    description: "Clarity Platinum Urinalysis Strips 10SG, MADE IN USA",
    packSize: "100/BX",
    unitPrice: "20.00",
  },
  {
    category: "UA Platinum",
    sku: "CLA-UHCRL25",
    description:
      "Clarity Platinum UA Controls -1X25 ml Negative and 1X25 ml Positive -For use with Clarity Platinum Urine Analyzer and Visual Read Clarity Microalbumin-Creatinine Test Strips CLA-MAC, MADE IN USA",
    packSize: "1 Set/Box",
    unitPrice: "70.00",
  },
  {
    category: "UA Platinum",
    sku: "CLA-PLTUA",
    description: "Clarity Platinum Urine Analyzer Only, MADE IN USA",
    packSize: "1/BX",
    unitPrice: "675.00",
  },
  {
    category: "UA Platinum",
    sku: "CLA-PLTUAPROMO5",
    description:
      "Platinum Placement Promo, Purchase 5 Bottles of Platinum 10SG - CLA-10P & 1 Box of Controls - CLA-UHCRL25 & Receive a Platinum Analyzer at No Charge *Drop Ship Only",
    packSize: "1/KIT",
    unitPrice: "170.00",
  },
  {
    category: "UA Visual Read",
    sku: "CLA-MAC",
    description: "Microalbumin Visual Read Read only",
    packSize: "25/BX",
    unitPrice: "39.95",
  },
  {
    category: "UA Urocheck",
    sku: "DTG-10SG",
    description:
      "Clarity Urocheck 10SG - 10 Parameter Urine Test Strip Reads: Leukocytes, Nitrites, Urobilinogen, Protein, pH, Blood, Ketone, Specific Gravity, Bilirubin, Glucose.",
    packSize: "100/BX",
    unitPrice: "21.95",
  },
  {
    category: "UA Urocheck",
    sku: "CD-MAC25",
    description:
      'Clarity Urocheck Urine Test Strip reads : Microalbumin and Creatinine. Visual Read or Clarity Urine Analyzer Compatible. "CLIA Waived"- ONLY FOR SALE IN USA, NOT FOR SALE IN CANADA',
    packSize: "25/BX",
    unitPrice: "49.00",
  },
  {
    category: "UA Urocheck",
    sku: "DTG-URO7",
    description:
      "7 Parameter Urine Test Strip Reads: Leukocytes, Nitrites, Protein, pH, Blood, Ketone, Glucose.",
    packSize: "100/BX",
    unitPrice: "17.50",
  },
  {
    category: "UA Urocheck",
    sku: "DTG-5OB",
    description:
      "5 Parameter Urine Test Strip Reads: Leukocytes, Nitrites, Protein, Blood, Glucose.",
    packSize: "100/BX",
    unitPrice: "11.95",
  },
  {
    category: "UA Urocheck",
    sku: "DTG-4OB",
    description:
      "4 Parameter Urine Test Strip Reads: Leukocytes, Protein, Blood, Glucose.",
    packSize: "100/BX",
    unitPrice: "10.95",
  },
  {
    category: "UA Urocheck",
    sku: "DTG-2GP",
    description: "2 Parameter Urine Test Strip Reads: Protein, Glucose.",
    packSize: "100/BX",
    unitPrice: "9.75",
  },
  {
    category: "UA Urocheck",
    sku: "DTG-KET",
    description: "Clarity Ketocheck Strips",
    packSize: "100/BX",
    unitPrice: "5.49",
  },
  {
    category: "UA Urocheck",
    sku: "CD-UCTL30",
    description:
      "CLARITY Urocheck Urine Controls 3x10mL For use with Clarity/Clarify Urine Strips and analyzers only *SHIPPED ON ICE IN A STYROFOAM COOLER* *MAX 3 DAY TRANSIT* *REFRIGERATE UPON ARRIVAL* *PLUS FREIGHT* ONLY FOR SALE IN USA, NOT FOR SALE IN CANADA",
    packSize: "1/CA",
    unitPrice: "1575.00",
  },
  {
    category: "UA Urocheck",
    sku: "DTG-UHCTLS",
    description:
      "Clarity Urine/HCG Controls 1x15ml +/- FOR USE WITH SIEMENS/ROCHE UA STRIPS and HCG TESTS ONLY 1/BX 24BX/CA *Can ship UPS Ground. No ice required. Refrigerate upon arrival*",
    packSize: "1/BX",
    unitPrice: "34.95",
  },
  {
    category: "UA",
    sku: "CLA-UCT",
    description: "Clarity Urine Specimen Cups w/ Temperature Strip",
    packSize: "400/CA",
    unitPrice: "270.00",
  },
  {
    category: "All Analyzers",
    sku: "DTG-UAPPR",
    description: "Clarity Paper Rolls (for use with Urine Reader) 4/PK 12PK/CS",
    packSize: "4/PK",
    unitPrice: "14.25",
  },
  {
    category: "All Analyzers",
    sku: "DTG-UASPPR",
    description: "Clarity Sticky Paper Rolls (for use with Urine Reader)",
    packSize: "4/PK",
    unitPrice: "26.35",
  },
  {
    category: "Infectious Disease",
    sku: "DTG-MONO",
    description:
      'CLARITY Mononucleosis "CLIA Waived"- Whole Blood Only, MADE IN USA',
    packSize: "15/BX",
    unitPrice: "31.00",
  },
  {
    category: "Infectious Disease",
    sku: "DTG-STP25",
    description: 'CLARITY Strep A Strip pouch "CLIA Waived" MADE IN USA',
    packSize: "25/BX",
    unitPrice: "30.00",
  },
  {
    category: "Infectious Disease",
    sku: "DTG-STPFLIP",
    description: 'Clarity Strep A, Flip Cassette, CLIA Waived" MADE IN USA',
    packSize: "25/BX",
    unitPrice: "45.00",
  },
  {
    category: "Infectious Disease",
    sku: "DTG-STPSWABS",
    description: "CLARITY (24 packs of 25 Strep swabs), MADE IN USA",
    packSize: "1/CS",
    unitPrice: "104.00",
  },
  {
    category: "Infectious Disease",
    sku: "DTG-STPTUBES",
    description: "CLARITY (24 packets of 25 Strep Tubes), MADE IN USA",
    packSize: "1/CS",
    unitPrice: "55.00",
  },
  {
    category: "Infectious Disease",
    sku: "CLA-RSVNS25",
    description: "CLARITY RSV Antigen Test, MADE IN USA",
    packSize: "25/BX",
    unitPrice: "140.00",
  },
  {
    category: "Infectious Disease",
    sku: "CLA-COV19-AG20",
    description: "Clarity CLIA waived COVID 19 antigen MADE IN USA 20 pack",
    packSize: "20/BX",
    unitPrice: "65.00",
  },
  {
    category: "Pregnancy",
    sku: "DTG-HCG25",
    description: 'CLARITY HCG Test Strip (Box 25) "CLIA Waived"',
    packSize: "25/BX",
    unitPrice: "8.00",
  },
  {
    category: "Pregnancy",
    sku: "DTG-PLUS25",
    description: 'CLARITY HCG Test Cassettes (Box 25) "CLIA Waived"',
    packSize: "25/BX",
    unitPrice: "9.00",
  },
  {
    category: "Pregnancy",
    sku: "DTG-COMBO",
    description: "Clarity Urine Serum Combo 20/10",
    packSize: "50/ BX",
    unitPrice: "22.95",
  },
  {
    category: "Pregnancy",
    sku: "OTC-HCGMID2",
    description:
      "Clarity HCG Midstream Test, OTC approved for Home Use (2 tests per box)",
    packSize: "2/BX",
    unitPrice: "4.75",
  },
  {
    category: "Blood Glucose",
    sku: "CD-BG1",
    description: "Clarity BG1000 Blood Glucose Meter Kit",
    packSize: "1/BX",
    unitPrice: "7.99",
  },
  {
    category: "Blood Glucose",
    sku: "CD-BG4",
    description:
      "Clarity BG1000 Glucose Controls set , 1 Vial of Normal and 1 Vial of High Controls",
    packSize: "1/BX",
    unitPrice: "5.85",
  },
  {
    category: "Blood Glucose",
    sku: "CD-BG5",
    description: "Clarity BG1000 Blood Glucose Meter Strips",
    packSize: "50/BX",
    unitPrice: "5.70",
  },
  {
    category: "Blood Glucose",
    sku: "CD-BG15PROMO",
    description:
      "Clarity BG1000 Glucose Meter Promo (5 Boxes of CD-BG5 and 1 Box of CD-BG4, 1 FREE CD-BG1)",
    packSize: "1/Kit",
    unitPrice: "33.75",
  },
  {
    category: "Lancing Devices",
    sku: "DTG-GL7",
    description:
      "CLARITY Lancet refills (100) for use with DTG-GL6, Clarity Lancing Device, NOT FOR SALE IN CANADA",
    packSize: "1/BX",
    unitPrice: "1.55",
  },
  {
    category: "Lancing Devices",
    sku: "DTG-GL6",
    description: "Clarity Auto Lancet",
    packSize: "1/BX",
    unitPrice: "9.50",
  },
  {
    category: "Lancing Devices",
    sku: "DTG-SL23100",
    description: "CLARITY Safety Lancets 26G 100/BX",
    packSize: "100/BX",
    unitPrice: "10.00",
  },
  {
    category: "Hemoglobin",
    sku: "CLA-HB2",
    description:
      'Clarity HbCheck Hemoglobin Meter "CLIA Waived" - Includes one Hemoglobin Meter, Quick Start and Reference Guides, and Manual.',
    packSize: "1/EA",
    unitPrice: "189.00",
  },
  {
    category: "Hemoglobin",
    sku: "CLA-HB4",
    description:
      "Clarity HbCheck Hemoglobin Controls Lvl 0/1/2 2mL EA (STORE @ 2-8*C) DROP SHIP ONLY ICEPACKS",
    packSize: "1/PK",
    unitPrice: "49.99",
  },
  {
    category: "Hemoglobin",
    sku: "CLA-HBS50",
    description:
      "Clarity HbCheck Hemoglobin Strips CLIA Waived 50/BX (Packaged 10 Strips/Vial -5 Vials/BX)",
    packSize: "50/BX",
    unitPrice: "49.50",
  },
  {
    category: "Hemoglobin",
    sku: "CLA-HBPROMO1",
    description:
      "Clarity HB check Hemoglobin Meter Starter Kit, 1 box of 100 test cartridges",
    packSize: "1/BX",
    unitPrice: "185.00",
  },
  {
    category: "DOA",
    sku: "CD-DAL-201",
    description:
      'Clarity Urine Alcohol Rapid Test Cassette 25/BX "FORENSIC USE ONLY"',
    packSize: "25/BX",
    unitPrice: "32.50",
  },
  {
    category: "DOA",
    sku: "DET-114",
    description: 'Ethyl Glucuronide (ETG) Single Dip Card "FORENSIC USE ONLY"',
    packSize: "25/BX 20BX/CS",
    unitPrice: "55.00",
  },
  {
    category: "DOA",
    sku: "CD-FTN-114",
    description: 'Fentanyl Dip Card "FORENSIC USE ONLY"',
    packSize: "25/BX 20BX/CS",
    unitPrice: "55.00",
  },
  {
    category: "DOA",
    sku: "CD-DOA-254",
    description:
      'Clarity Dip Card 5 Panel AMP, COC, MAMP (MET), OPI2000 (OPI), THC "CLIA WAIVED"',
    packSize: "25/BX 20BX/CS",
    unitPrice: "30.00",
  },
  {
    category: "DOA",
    sku: "CD-DOA-1104",
    description:
      "CLARITY 10 Parameter Drug panel (COC/THC/OPI2000/AMP/MET/PCP/BZO/BAR/MTD/OXY)",
    packSize: "25/BX 20BX/CS",
    unitPrice: "40.00",
  },
  {
    category: "DOA",
    sku: "CD-DOA-1115",
    description:
      "Dip Card 11 Panel AMP, BAR, BUP, BZO, COC, MET, OPI300 (MOR), OXY, PCP, TCA, THC",
    packSize: "25/BX 20BX/CS",
    unitPrice: "42.00",
  },
  {
    category: "DOA",
    sku: "CD-DOA-6125",
    description:
      "Dip Card 12 Panel AMP, BAR, BUP, BZO, COC, MAMP (MET), MDMA, MTD, OPI300 (MOP), OXY, PCP, THC",
    packSize: "25/BX 20BX/CS",
    unitPrice: "42.00",
  },
  {
    category: "DOA",
    sku: "CD-CDOA-4104",
    description:
      "Round Cup 10 Panel AMP, BAR, BZO, COC, MAMP (MET), MTD, OPI2000 (OPI), OXY, PCP, THC",
    packSize: "25/BX 4BX/CS",
    unitPrice: "45.00",
  },
  {
    category: "DOA",
    sku: "CD-CDOA-7115",
    description:
      "11 Panel Cup AMP, BAR, BZO, COC, MAMP, MDMA, OPI300 (MOR), MTD, OXY, PCP, TCA 25/BX 10BX/CS",
    packSize: "25/BX 4BX/CS",
    unitPrice: "45.00",
  },
  {
    category: "DOA",
    sku: "CD-CDOA-7125",
    description:
      "Round Cup 12 Panel AMP, BAR, BZO, COC, MAMP, MDMA, OPI300 (MOR), MTD, OXY, PCP, TCA, THC",
    packSize: "25/BX 4BX/CS",
    unitPrice: "47.00",
  },
  {
    category: "DOA",
    sku: "CD-CDOA-6124",
    description:
      "Round Cup 12 Panel AMP, BAR, BUP, BZO, COC, MAMP (MET), MDMA, MTD, OPI2000 (OPI), OXY, PCP, THC",
    packSize: "25/BX 4BX/CS",
    unitPrice: "47.00",
  },
  {
    category: "DOA",
    sku: "CD-CDOA-6125",
    description:
      "Round Cup 12 Panel AMP, BAR, BUP, BZO, COC, MAMP (MET), MDMA, MTD, OPI300 (MOP), OXY, PCP, THC",
    packSize: "25/BX 4BX/CS",
    unitPrice: "47.00",
  },
  {
    category: "DOA",
    sku: "CD-CDOA-8145FNF",
    description:
      "DOA Cup CLIA Wiaved Panel AMP, BAR, BUP, BZO, COC, MAMP (MET), MDMA, MTD, OPI300 (MOP), OXY, PCP, THC, FEN, NORFEN",
    packSize: "25/BX 4BX/CS",
    unitPrice: "60.00",
  },
  {
    category: "DOA",
    sku: "CD-CDOA-1144",
    description:
      "Clarity CLIA Waived Drug Test Cup 14 Panel COC300/THC/OPI2000/BZO/mAMP1000/TCA/OXY/BUP/BAR/MTD/AMP1000/MDMA/PCP/PPX300",
    packSize: "25/BX 4BX/CS",
    unitPrice: "60.00",
  },
  {
    category: "DOA",
    sku: "DTG-ADUSTP",
    description: "Clarity Urine Adulteration Strips",
    packSize: "25/BX",
    unitPrice: "11.00",
  },
  {
    category: "DOA",
    sku: "CD-DOACTLS10",
    description:
      "Clarity Drug Test Controls, (1) Negative Vial, (1) Positive Vial 1/SET 10ml *OVERNIGHT ICE PACKS* *REFRIGERATE UPON ARRIVAL* *PLUS FREIGHT* 1/CA",
    packSize: "1/EA",
    unitPrice: "60.00",
  },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function random(): number {
  return rng();
}

function int(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function chance(probability: number): boolean {
  return random() < probability;
}

function pick<T>(values: readonly T[]): T {
  return values[int(0, values.length - 1)];
}

function shuffle<T>(values: readonly T[]): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sample<T>(values: readonly T[], count: number): T[] {
  return shuffle(values).slice(0, count);
}

function money(value: number): string {
  return value.toFixed(2);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 14, 0, 0));
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function monthRange(
  startYear: number,
  startMonthIndex: number,
  endYear: number,
  endMonthIndex: number,
): Array<{ year: number; monthIndex: number }> {
  const result: Array<{ year: number; monthIndex: number }> = [];
  let year = startYear;
  let monthIndex = startMonthIndex;

  while (year < endYear || (year === endYear && monthIndex <= endMonthIndex)) {
    result.push({ year, monthIndex });
    monthIndex += 1;
    if (monthIndex > 11) {
      year += 1;
      monthIndex = 0;
    }
  }

  return result;
}

function buildEmail(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".") || "user"}@example.com`;
}

function buildUniquePhone(index: number): string {
  const exchange = 200 + (index % 700);
  const lineNumber = 1000 + ((index * 37) % 9000);
  return `555-${String(exchange).padStart(3, "0")}-${String(lineNumber).padStart(4, "0")}`;
}

function buildCompanyProfile(index: number): {
  companyName: string;
  companySlug: string;
  primaryContactName: string;
  billingAddress: string;
  shippingAddress: string;
  email: string;
  phone: string;
} {
  const prefix = companyPrefixes[index % companyPrefixes.length];
  const market =
    companyMarkets[
      Math.floor(index / companyPrefixes.length) % companyMarkets.length
    ];
  const suffix =
    companySuffixes[
      Math.floor(index / (companyPrefixes.length * companyMarkets.length)) %
        companySuffixes.length
    ];
  const descriptor =
    companyDescriptors[
      Math.floor(
        index /
          (companyPrefixes.length *
            companyMarkets.length *
            companySuffixes.length),
      ) % companyDescriptors.length
    ];
  const location = companyCities[index % companyCities.length]!;
  const companyName = `${prefix} ${market} ${suffix}`;
  const brandedName =
    descriptor === "Collective" ? companyName : `${companyName} ${descriptor}`;
  const companySlug = `${prefix}-${market}-${location.city}-${index + 1}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const first = firstNames[index % firstNames.length]!;
  const last =
    lastNames[Math.floor(index / firstNames.length) % lastNames.length]!;
  const primaryContactName = `${first} ${last}`;
  const billingStreet = `${120 + index * 17} ${pick(["Market", "Commerce", "Harbor", "Summit", "Bridge", "Orchard"])} ${pick(["St", "Ave", "Blvd", "Dr"])}`;
  const shippingStreet = `${220 + index * 19} ${pick(["Logistics", "Distribution", "Industrial", "Warehouse", "Transit"])} ${pick(["Way", "Rd", "Dr", "Ct"])}`;

  return {
    companyName: brandedName,
    companySlug,
    primaryContactName,
    billingAddress: `${billingStreet}, ${location.city}, ${location.state}`,
    shippingAddress: `${shippingStreet}, ${location.city}, ${location.state}`,
    email: `${companySlug}@demo.clarity.local`,
    phone: buildUniquePhone(index),
  };
}

function buildCatalogName(description: string): string {
  const candidates = [
    " -For use",
    " *",
    " ONLY FOR SALE",
    " DROP SHIP ONLY",
    ", MADE IN USA",
    " MADE IN USA",
  ];

  let name = description.trim();
  for (const token of candidates) {
    const index = name.indexOf(token);
    if (index > 0) {
      name = name.slice(0, index).trim();
      break;
    }
  }

  name = name
    .replace(/\s+/g, " ")
    .replace(/[,\-"]+$/, "")
    .trim();
  return name.length > 96 ? `${name.slice(0, 93).trimEnd()}...` : name;
}

function buildCatalogCertifications(description: string): string[] {
  const certifications: string[] = [];
  if (/CLIA\s*WAIVED/i.test(description)) certifications.push("CLIA Waived");
  if (/MADE IN USA/i.test(description)) certifications.push("Made in USA");
  if (/OTC approved/i.test(description)) certifications.push("OTC Approved");
  if (/FORENSIC USE ONLY/i.test(description))
    certifications.push("Forensic Use Only");
  return certifications;
}

function buildRepRows(): SalesRepRow[] {
  const demoReps = [
    { name: "Ava Rodriguez", email: "ava.rodriguez@clarity.local" },
    { name: "Daniel Kim", email: "daniel.kim@clarity.local" },
    { name: "Sofia Patel", email: "sofia.patel@clarity.local" },
    { name: "Marcus Johnson", email: "marcus.johnson@clarity.local" },
  ];

  return Array.from({ length: REP_COUNT }, (_, index) => {
    const demoRep = demoReps[index];
    if (demoRep) return demoRep;

    const first = firstNames[index % firstNames.length];
    const last = lastNames[(index * 3) % lastNames.length];
    const name = `${first} ${last}`;
    return {
      name,
      email: buildEmail(`${first}.${last}`),
    };
  });
}

function buildProductRows(): ProductRow[] {
  return catalogSeedRows.map((row, index) => {
    const unitPrice = Number(row.unitPrice);
    const inventoryQty =
      index % 6 === 0
        ? 0
        : Math.max(
            12,
            Math.round(
              ((index % 4) + 1) * 18 +
                Math.min(unitPrice, 250) * (unitPrice >= 100 ? 0.08 : 0.7),
            ),
          );
    const etaDate =
      inventoryQty === 0
        ? dateOnly(addDays(new Date(), 7 + (index % 5) * 9))
        : null;
    const averageCost = money(unitPrice * (0.42 + (index % 4) * 0.05));
    const lastPurchaseCost = money(unitPrice * (0.4 + (index % 5) * 0.055));

    return {
      sku: row.sku,
      name: buildCatalogName(row.description),
      category: row.category,
      description: row.description,
      unitPrice: row.unitPrice,
      inventoryQty,
      averageCost,
      lastPurchaseCost,
      etaDate,
      imageUrl: null,
      packSize: row.packSize.trim(),
      certifications: buildCatalogCertifications(row.description),
      brochureUrl: null,
      infoSheetUrl: null,
    };
  });
}

function buildCustomerRows(repIds: number[]): CustomerRow[] {
  return Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const profile = buildCompanyProfile(index);
    const repId = repIds[index % repIds.length];
    const creditLimit = 10000 + int(0, 9) * 2500 + int(0, 999);
    const customTerms = chance(0.5) ? pick(termsOptions) : null;
    const status =
      index < 24
        ? customerStatuses[0]
        : index < 32
          ? customerStatuses[1]
          : index < 36
            ? customerStatuses[2]
            : customerStatuses[3];
    const customerSinceDate = dateOnly(
      addDays(utcDate(2022, index % 12, int(1, 24)), -int(45, 720)),
    );

    return {
      name: profile.companyName,
      companyName: profile.companyName,
      primaryContactName: profile.primaryContactName,
      email: profile.email,
      phone: profile.phone,
      address: profile.billingAddress,
      billingAddress: profile.billingAddress,
      shippingAddress: profile.shippingAddress,
      status,
      repId,
      creditLimit: money(creditLimit),
      customPricing: chance(0.28),
      customTerms,
      customerSinceDate,
    };
  });
}

function buildCustomerContacts(
  customers: Array<{
    id: number;
    companyName: string;
    primaryContactName: string;
    email: string | null;
    phone: string | null;
  }>,
): CustomerContactRow[] {
  return customers.flatMap((customer, index) => {
    const primaryContact: CustomerContactRow = {
      customerId: customer.id,
      name: customer.primaryContactName,
      title: "Primary Buyer",
      email: customer.email ?? buildEmail(customer.primaryContactName),
      phone: customer.phone,
      isPrimary: true,
    };

    const extraCount = index % 3 === 0 ? 2 : 1;
    const extras = Array.from({ length: extraCount }, (_, contactIndex) => {
      const contactSeed = index * 3 + contactIndex + CUSTOMER_COUNT;
      const first = firstNames[contactSeed % firstNames.length];
      const last =
        lastNames[
          Math.floor(contactSeed / firstNames.length) % lastNames.length
        ];
      const name = `${first} ${last}`;
      return {
        customerId: customer.id,
        name,
        title: contactTitles[(index + contactIndex) % contactTitles.length],
        email: buildEmail(`${first}.${last}`),
        phone: buildUniquePhone(contactSeed),
        isPrimary: false,
      } satisfies CustomerContactRow;
    });

    return [primaryContact, ...extras];
  });
}

function buildCustomerActivities(
  customers: Array<{
    id: number;
    companyName: string;
    primaryContactName: string;
    status: string;
    customerSinceDate: string | null;
  }>,
): CustomerActivityRow[] {
  return customers.flatMap((customer, index) => {
    const createdBy = index % 2 === 0 ? "Jane Smith" : "Ben Carter";
    const baseDate = new Date(
      Date.UTC(2026, 5, Math.max(1, 3 - (index % 3)), 14, 0, 0),
    );
    const taskDueDate = dateOnly(addDays(baseDate, index % 2 === 0 ? 5 : 12));

    return [
      {
        customerId: customer.id,
        activityType: "note",
        subject: "Account summary updated",
        details: noteTemplates[index % noteTemplates.length],
        outcome: null,
        dueDate: null,
        isCompleted: true,
        createdBy,
        createdAt: addDays(baseDate, -2),
      },
      {
        customerId: customer.id,
        activityType: "call",
        subject: `Follow-up call with ${customer.primaryContactName}`,
        details: `Reviewed open items for ${customer.companyName} and confirmed forecast priorities.`,
        outcome: callOutcomes[index % callOutcomes.length],
        dueDate: null,
        isCompleted: true,
        createdBy,
        createdAt: addDays(baseDate, -1),
      },
      {
        customerId: customer.id,
        activityType: "meeting",
        subject: "Customer touchpoint",
        details: meetingNotes[index % meetingNotes.length],
        outcome: "Action items captured in CRM",
        dueDate: null,
        isCompleted: true,
        createdBy,
        createdAt: baseDate,
      },
      {
        customerId: customer.id,
        activityType: "email",
        subject: emailSubjects[index % emailSubjects.length],
        details: `Emailed ${customer.primaryContactName} with supporting documentation and next steps.`,
        outcome: "Sent",
        dueDate: null,
        isCompleted: true,
        createdBy,
        createdAt: addDays(baseDate, 1),
      },
      {
        customerId: customer.id,
        activityType: "task",
        subject:
          customer.status === "prospect"
            ? "Schedule conversion follow-up"
            : "Confirm next reorder timing",
        details:
          customer.status === "on_hold"
            ? "Resolve account hold items before new shipment release."
            : "Reach out with next suggested order window and open action items.",
        outcome: null,
        dueDate: taskDueDate,
        isCompleted: false,
        createdBy,
        createdAt: addDays(baseDate, 2),
      },
    ];
  });
}

function buildPromotions(
  productIds: number[],
): Array<{ promo: PromotionRow; productIds: number[] }> {
  const baseWindows = [
    { name: promoNames[0], start: "2025-01-01", end: "2025-02-28" },
    { name: promoNames[1], start: "2025-03-01", end: "2025-04-30" },
    { name: promoNames[2], start: "2025-05-01", end: "2025-06-30" },
    { name: promoNames[3], start: "2025-07-01", end: "2025-08-31" },
    { name: promoNames[4], start: "2025-09-01", end: "2025-10-31" },
    { name: promoNames[5], start: "2025-11-01", end: "2025-12-31" },
    { name: promoNames[6], start: "2026-01-01", end: "2026-02-28" },
    { name: promoNames[7], start: "2026-05-15", end: "2026-06-30" },
    { name: promoNames[8], start: "2026-06-01", end: "2026-07-31" },
  ];

  const windows = Array.from({ length: PROMOTION_COUNT }, (_, index) => {
    const base = baseWindows[index % baseWindows.length]!;
    return {
      name:
        index < baseWindows.length
          ? base.name
          : `${base.name} ${index - baseWindows.length + 2}`,
      start: base.start,
      end: base.end,
    };
  });

  const groupedProducts = Array.from({ length: PROMOTION_COUNT }, (_, index) =>
    productIds.slice(index * 4, index * 4 + 4),
  );

  return windows.map((window, index) => ({
    promo: {
      name: window.name,
      discountType: index % 2 === 0 ? "percent" : "fixed",
      discountValue:
        index % 2 === 0 ? money(8 + index * 1.5) : money(4 + index * 2.25),
      startDate: window.start,
      endDate: window.end,
    },
    productIds: groupedProducts[index] ?? [],
  }));
}

function buildMonthlyOrderCounts(year: number, monthIndex: number): number {
  if (year === 2025) {
    if (monthIndex <= 2) return 12 + monthIndex * 3;
    if (monthIndex <= 5) return 18 + monthIndex * 2;
    if (monthIndex <= 8) return 24 + (monthIndex - 6) * 4;
    return 32 + (monthIndex - 9) * 3;
  }

  if (year === 2026 && monthIndex <= 1) return 34 + monthIndex * 2;
  if (year === 2026 && monthIndex <= 3) return 40 + (monthIndex - 2) * 4;
  if (year === 2026 && monthIndex === 4) return 52;
  if (year === 2026 && monthIndex === 5) return 38;

  return 24;
}

function chooseStatus(): (typeof orderStatuses)[number] {
  const roll = random();
  if (roll < 0.06) return "cancelled";
  if (roll < 0.26) return "open";
  if (roll < 0.5) return "in_transit";
  return "fulfilled";
}

function customerOrderWeight(customer: { status: string }): number {
  switch (customer.status) {
    case "active":
      return 1;
    case "prospect":
      return 0.4;
    case "on_hold":
      return 0.2;
    case "inactive":
      return 0.08;
    default:
      return 0.25;
  }
}

function pickWeightedCustomer<T extends { status: string }>(customers: T[]): T {
  const totalWeight = customers.reduce(
    (sum, customer) => sum + customerOrderWeight(customer),
    0,
  );
  let cursor = random() * totalWeight;

  for (const customer of customers) {
    cursor -= customerOrderWeight(customer);
    if (cursor <= 0) {
      return customer;
    }
  }

  return customers[customers.length - 1]!;
}

function buildSupplyVendors(): SupplyVendorRow[] {
  return [
    {
      name: "Ningbo Harbor Manufacturing",
      vendorCode: "NHM-CN",
      primaryContactName: "Lydia Chen",
      email: "lchen@nhmco.cn",
      phone: "+86 574 555 0198",
      leadTimeDays: 46,
      onTimeDeliveryPct: "91.00",
      shipmentCount: 22,
      totalSpend: "3184000.00",
      qualityRating: "4.7",
    },
    {
      name: "Monterrey Plastics Group",
      vendorCode: "MPG-MX",
      primaryContactName: "Diego Alvarez",
      email: "dalvarez@mpg.mx",
      phone: "+52 81 5550 8821",
      leadTimeDays: 18,
      onTimeDeliveryPct: "96.00",
      shipmentCount: 31,
      totalSpend: "2179000.00",
      qualityRating: "4.5",
    },
    {
      name: "Saigon Components Ltd.",
      vendorCode: "SCL-VN",
      primaryContactName: "Minh Tran",
      email: "minh.tran@scl.vn",
      phone: "+84 28 5555 2121",
      leadTimeDays: 54,
      onTimeDeliveryPct: "84.00",
      shipmentCount: 16,
      totalSpend: "2742000.00",
      qualityRating: "4.2",
    },
    {
      name: "Rotterdam Fixture Works",
      vendorCode: "RFW-NL",
      primaryContactName: "Eva van Dijk",
      email: "eva@rfw.nl",
      phone: "+31 10 555 8802",
      leadTimeDays: 35,
      onTimeDeliveryPct: "93.00",
      shipmentCount: 11,
      totalSpend: "1385000.00",
      qualityRating: "4.8",
    },
    {
      name: "Ontario Packaging Supply",
      vendorCode: "OPS-CA",
      primaryContactName: "Sarah Moore",
      email: "smoore@ontpack.ca",
      phone: "+1 416 555 2104",
      leadTimeDays: 12,
      onTimeDeliveryPct: "97.00",
      shipmentCount: 19,
      totalSpend: "864000.00",
      qualityRating: "4.6",
    },
  ];
}

function buildSupplyShipments(
  vendorIdsByCode: Map<string, number>,
): SupplyShipmentRow[] {
  return [
    {
      shipmentId: "SHP-240318",
      vendorId: vendorIdsByCode.get("NHM-CN")!,
      origin: "Ningbo, China",
      destination: "Newark, NJ",
      departureDate: "2026-05-11",
      eta: "2026-06-09",
      status: "Customs",
      trackingNumber: "MAEU-55401928",
      purchaseOrderNumber: "PO-10984",
      containerNumber: "OOLU-184239-7",
      skuCount: 12,
      quantity: 14200,
      productCost: "218400.00",
      freightCost: "22600.00",
      customsAndDuties: "18340.00",
      brokerageFees: "3200.00",
      drayage: "2750.00",
      warehouseReceivingCosts: "1650.00",
      miscellaneousCosts: "980.00",
      notes:
        "CBP exam completed. Awaiting customs release and final drayage appointment.",
      documents: [
        { name: "Commercial invoice", status: "Uploaded" },
        { name: "Packing list", status: "Uploaded" },
        { name: "Bill of lading", status: "Uploaded" },
        { name: "Freight invoice", status: "Uploaded" },
        { name: "Customs paperwork", status: "Pending" },
        { name: "Vendor invoice", status: "Uploaded" },
        { name: "Receiving photos", status: "Missing" },
      ],
      timeline: [
        "PO Created",
        "Production",
        "Departed Origin",
        "In Transit",
        "Customs",
      ],
    },
    {
      shipmentId: "SHP-240326",
      vendorId: vendorIdsByCode.get("MPG-MX")!,
      origin: "Monterrey, Mexico",
      destination: "Dallas, TX",
      departureDate: "2026-05-28",
      eta: "2026-06-05",
      status: "Out for Delivery",
      trackingNumber: "FX-9982013341",
      purchaseOrderNumber: "PO-11012",
      containerNumber: "TRL-4401",
      skuCount: 8,
      quantity: 6200,
      productCost: "94400.00",
      freightCost: "6400.00",
      customsAndDuties: "3180.00",
      brokerageFees: "950.00",
      drayage: "0.00",
      warehouseReceivingCosts: "1140.00",
      miscellaneousCosts: "420.00",
      notes:
        "Carrier confirmed warehouse appointment for tomorrow morning at 8:30 AM.",
      documents: [
        { name: "Commercial invoice", status: "Uploaded" },
        { name: "Packing list", status: "Uploaded" },
        { name: "Bill of lading", status: "Uploaded" },
        { name: "Freight invoice", status: "Pending" },
        { name: "Customs paperwork", status: "Uploaded" },
        { name: "Vendor invoice", status: "Uploaded" },
        { name: "Receiving photos", status: "Missing" },
      ],
      timeline: [
        "PO Created",
        "Production",
        "Departed Origin",
        "In Transit",
        "Customs",
      ],
    },
    {
      shipmentId: "SHP-240301",
      vendorId: vendorIdsByCode.get("SCL-VN")!,
      origin: "Ho Chi Minh City, Vietnam",
      destination: "Long Beach, CA",
      departureDate: "2026-04-27",
      eta: "2026-06-12",
      status: "Delayed",
      trackingNumber: "CMA-11209854",
      purchaseOrderNumber: "PO-10941",
      containerNumber: "TCNU-329911-2",
      skuCount: 15,
      quantity: 18900,
      productCost: "286200.00",
      freightCost: "33100.00",
      customsAndDuties: "24580.00",
      brokerageFees: "3550.00",
      drayage: "2960.00",
      warehouseReceivingCosts: "1880.00",
      miscellaneousCosts: "2410.00",
      notes:
        "Port congestion pushed arrival by 6 days. Finance flagged higher-than-expected accessorial charges.",
      documents: [
        { name: "Commercial invoice", status: "Uploaded" },
        { name: "Packing list", status: "Uploaded" },
        { name: "Bill of lading", status: "Uploaded" },
        { name: "Freight invoice", status: "Pending" },
        { name: "Customs paperwork", status: "Pending" },
        { name: "Vendor invoice", status: "Uploaded" },
        { name: "Receiving photos", status: "Missing" },
      ],
      timeline: ["PO Created", "Production", "Departed Origin", "In Transit"],
    },
    {
      shipmentId: "SHP-240333",
      vendorId: vendorIdsByCode.get("RFW-NL")!,
      origin: "Rotterdam, Netherlands",
      destination: "Savannah, GA",
      departureDate: "2026-05-21",
      eta: "2026-06-18",
      status: "In Transit",
      trackingNumber: "MSC-44732019",
      purchaseOrderNumber: "PO-11033",
      containerNumber: "MSCU-818302-5",
      skuCount: 10,
      quantity: 9800,
      productCost: "167500.00",
      freightCost: "18820.00",
      customsAndDuties: "14120.00",
      brokerageFees: "2140.00",
      drayage: "1940.00",
      warehouseReceivingCosts: "1290.00",
      miscellaneousCosts: "600.00",
      notes: "Ocean leg on schedule. No exceptions reported by forwarder.",
      documents: [
        { name: "Commercial invoice", status: "Uploaded" },
        { name: "Packing list", status: "Uploaded" },
        { name: "Bill of lading", status: "Uploaded" },
        { name: "Freight invoice", status: "Pending" },
        { name: "Customs paperwork", status: "Pending" },
        { name: "Vendor invoice", status: "Uploaded" },
        { name: "Receiving photos", status: "Missing" },
      ],
      timeline: ["PO Created", "Production", "Departed Origin", "In Transit"],
    },
    {
      shipmentId: "SHP-240289",
      vendorId: vendorIdsByCode.get("OPS-CA")!,
      origin: "Toronto, Canada",
      destination: "Buffalo, NY",
      departureDate: "2026-05-29",
      eta: "2026-06-04",
      status: "Received",
      trackingNumber: "UPS-4402198001",
      purchaseOrderNumber: "PO-10912",
      containerNumber: "LTL-2192",
      skuCount: 4,
      quantity: 3400,
      productCost: "41200.00",
      freightCost: "1950.00",
      customsAndDuties: "1290.00",
      brokerageFees: "420.00",
      drayage: "0.00",
      warehouseReceivingCosts: "760.00",
      miscellaneousCosts: "115.00",
      notes:
        "Received in full. Weighted average inventory cost updated after putaway.",
      documents: [
        { name: "Commercial invoice", status: "Uploaded" },
        { name: "Packing list", status: "Uploaded" },
        { name: "Bill of lading", status: "Uploaded" },
        { name: "Freight invoice", status: "Uploaded" },
        { name: "Customs paperwork", status: "Uploaded" },
        { name: "Vendor invoice", status: "Uploaded" },
        { name: "Receiving photos", status: "Uploaded" },
      ],
      timeline: [
        "PO Created",
        "Production",
        "Departed Origin",
        "In Transit",
        "Customs",
        "Warehouse Receipt",
      ],
    },
  ];
}

function buildSupplyCosting(): SupplyInventoryCostingRow[] {
  return catalogSeedRows.slice(0, 5).map((row, index) => {
    const sellingPrice = Number(row.unitPrice);
    const currentAverageCost = money(sellingPrice * (0.44 + index * 0.03));
    const lastPurchaseCost = money(sellingPrice * (0.46 + index * 0.03));
    const incomingLandedCost = money(sellingPrice * (0.49 + index * 0.03));

    return {
      sku: row.sku,
      productName: buildCatalogName(row.description),
      currentInventory: 180 + index * 95,
      currentAverageCost,
      lastPurchaseCost,
      incomingLandedCost,
      sellingPrice: row.unitPrice,
    };
  });
}

type SeedMode = "full" | "companies";

function parseSeedMode(): SeedMode {
  const rawMode = process.argv[2]?.trim().toLowerCase();
  if (!rawMode || rawMode === "full") return "full";
  if (rawMode === "companies") return "companies";
  throw new Error(`Unknown seed mode "${rawMode}". Use "full" or "companies".`);
}

async function resetAllDemoTables(): Promise<void> {
  await db.execute(
    sql.raw(`
    TRUNCATE TABLE
      customer_activities,
      customer_contacts,
      poster_post_targets,
      poster_posts,
      task_assignments,
      collaborative_tasks,
      auth_sessions,
      users,
      promotion_products,
      invoices,
      order_items,
      orders,
      promotions,
      customers,
      products,
      sales_reps,
      supply_activity_events,
      supply_documents,
      supply_inventory_movements,
      supply_vendor_bills,
      supply_receipt_lines,
      supply_receipts,
      supply_shipment_lines,
      supply_procurement_shipments,
      supply_purchase_order_lines,
      supply_purchase_orders,
      supply_shipments,
      supply_inventory_costing,
      supply_vendors
    RESTART IDENTITY CASCADE
  `),
  );
}

async function resetCompanyDemoTables(): Promise<void> {
  await db.execute(
    sql.raw(`
    TRUNCATE TABLE
      customer_activities,
      customer_contacts,
      poster_post_targets,
      poster_posts,
      task_assignments,
      collaborative_tasks,
      auth_sessions,
      users,
      invoices,
      order_items,
      orders,
      customers,
      sales_reps
    RESTART IDENTITY CASCADE
  `),
  );
}

async function seedCatalogAndSupply(): Promise<{
  products: ProductRecord[];
  promotions: number;
  supplyVendors: number;
  supplyShipments: number;
  supplyCostingRows: number;
}> {
  const insertedProducts = await db
    .insert(productsTable)
    .values(buildProductRows())
    .returning();
  const promoBlueprints = buildPromotions(
    insertedProducts.map((product) => product.id),
  );
  const insertedPromotions = await db
    .insert(promotionsTable)
    .values(promoBlueprints.map((entry) => entry.promo))
    .returning();

  const promotionLinks: Array<{ promotionId: number; productId: number }> = [];
  for (let i = 0; i < insertedPromotions.length; i += 1) {
    const promotion = insertedPromotions[i];
    if (!promotion) continue;
    for (const productId of promoBlueprints[i]?.productIds ?? []) {
      promotionLinks.push({ promotionId: promotion.id, productId });
    }
  }
  if (promotionLinks.length > 0) {
    await db.insert(promotionProductsTable).values(promotionLinks);
  }

  const insertedSupplyVendors = await db
    .insert(supplyVendorsTable)
    .values(buildSupplyVendors())
    .returning();
  const vendorIdsByCode = new Map(
    insertedSupplyVendors.map((vendor) => [vendor.vendorCode, vendor.id]),
  );
  const shipmentRows = buildSupplyShipments(vendorIdsByCode);
  await db.insert(supplyShipmentsTable).values(shipmentRows);
  const supplyCostingRows = buildSupplyCosting();
  await db.insert(supplyInventoryCostingTable).values(supplyCostingRows);

  const supplyProducts = insertedProducts.slice(0, 6);
  if (supplyProducts.length >= 6) {
    await db
      .update(productsTable)
      .set({ averageCost: "8.2500", lastPurchaseCost: "8.1000" })
      .where(
        sql`${productsTable.id} in (${sql.join(
          supplyProducts.map((product) => sql`${product.id}`),
          sql`, `,
        )})`,
      );

    const [draftPo, issuedPo, partialPo] = await db
      .insert(supplyPurchaseOrdersTable)
      .values([
        {
          poNumber: "PO-260601",
          vendorId: vendorIdsByCode.get("NHM-CN")!,
          status: "draft",
          orderDate: "2026-06-01",
          expectedDate: "2026-07-10",
          destination: "Newark, NJ",
          paymentTerms: "Net 30",
          notes: "Seasonal replenishment being prepared by purchasing.",
        },
        {
          poNumber: "PO-260527",
          vendorId: vendorIdsByCode.get("MPG-MX")!,
          status: "issued",
          orderDate: "2026-05-27",
          expectedDate: "2026-06-12",
          destination: "Dallas, TX",
          paymentTerms: "Net 30",
          issuedAt: new Date("2026-05-28T15:00:00Z"),
        },
        {
          poNumber: "PO-260510",
          vendorId: vendorIdsByCode.get("SCL-VN")!,
          status: "partially_received",
          orderDate: "2026-05-10",
          expectedDate: "2026-06-03",
          destination: "Long Beach, CA",
          paymentTerms: "Net 45",
          issuedAt: new Date("2026-05-11T15:00:00Z"),
        },
      ])
      .returning();

    const issuedLines = await db
      .insert(supplyPurchaseOrderLinesTable)
      .values([
        {
          purchaseOrderId: issuedPo.id,
          productId: supplyProducts[2]!.id,
          orderedQuantity: 3200,
          unitCost: "4.2000",
        },
        {
          purchaseOrderId: issuedPo.id,
          productId: supplyProducts[3]!.id,
          orderedQuantity: 900,
          unitCost: "18.4000",
        },
      ])
      .returning();
    const partialLines = await db
      .insert(supplyPurchaseOrderLinesTable)
      .values([
        {
          purchaseOrderId: partialPo.id,
          productId: supplyProducts[4]!.id,
          orderedQuantity: 1800,
          unitCost: "7.8000",
          receivedQuantity: 700,
          damagedQuantity: 20,
        },
        {
          purchaseOrderId: partialPo.id,
          productId: supplyProducts[5]!.id,
          orderedQuantity: 1200,
          unitCost: "11.2500",
          receivedQuantity: 400,
        },
      ])
      .returning();
    await db.insert(supplyPurchaseOrderLinesTable).values([
      {
        purchaseOrderId: draftPo.id,
        productId: supplyProducts[0]!.id,
        orderedQuantity: 2400,
        unitCost: "9.1000",
      },
      {
        purchaseOrderId: draftPo.id,
        productId: supplyProducts[1]!.id,
        orderedQuantity: 1600,
        unitCost: "5.7500",
      },
    ]);

    const [issuedShipment, partialShipment] = await db
      .insert(supplyProcurementShipmentsTable)
      .values([
        {
          shipmentNumber: "SHP-260527",
          purchaseOrderId: issuedPo.id,
          status: "in_transit",
          origin: "Monterrey, Mexico",
          destination: "Dallas, TX",
          departureDate: "2026-05-30",
          eta: "2026-06-08",
          carrier: "FedEx Freight",
          trackingNumber: "FX-260527-91",
          freightCost: "2850.00",
          customsAndDuties: "940.00",
          brokerageFees: "325.00",
          warehouseReceivingCosts: "480.00",
        },
        {
          shipmentNumber: "SHP-260510-A",
          purchaseOrderId: partialPo.id,
          status: "delivered",
          origin: "Ho Chi Minh City, Vietnam",
          destination: "Long Beach, CA",
          departureDate: "2026-05-13",
          eta: "2026-06-03",
          carrier: "CMA CGM",
          trackingNumber: "CMA-260510-A",
          containerNumber: "TCNU-260510",
          freightCost: "6200.00",
          customsAndDuties: "2450.00",
          brokerageFees: "620.00",
          drayage: "850.00",
          warehouseReceivingCosts: "510.00",
          miscellaneousCosts: "175.00",
        },
      ])
      .returning();

    await db.insert(supplyShipmentLinesTable).values([
      {
        shipmentId: issuedShipment.id,
        purchaseOrderLineId: issuedLines[0]!.id,
        quantity: 3200,
        allocatedLandedCost: "2044.4400",
      },
      {
        shipmentId: issuedShipment.id,
        purchaseOrderLineId: issuedLines[1]!.id,
        quantity: 900,
        allocatedLandedCost: "2550.5600",
      },
    ]);
    const partialShipmentLines = await db
      .insert(supplyShipmentLinesTable)
      .values([
        {
          shipmentId: partialShipment.id,
          purchaseOrderLineId: partialLines[0]!.id,
          quantity: 1200,
          allocatedLandedCost: "5250.0000",
        },
        {
          shipmentId: partialShipment.id,
          purchaseOrderLineId: partialLines[1]!.id,
          quantity: 800,
          allocatedLandedCost: "5555.0000",
        },
      ])
      .returning();

    const [receipt] = await db
      .insert(supplyReceiptsTable)
      .values({
        receiptNumber: "REC-260604",
        shipmentId: partialShipment.id,
        status: "confirmed",
        receivedBy: "Morgan Hill",
        discrepancyNotes:
          "Twenty units arrived with crushed cartons and were quarantined.",
        receivedAt: new Date("2026-06-04T14:30:00Z"),
        confirmedAt: new Date("2026-06-04T15:00:00Z"),
      })
      .returning();
    await db.insert(supplyReceiptLinesTable).values([
      {
        receiptId: receipt.id,
        shipmentLineId: partialShipmentLines[0]!.id,
        acceptedQuantity: 700,
        damagedQuantity: 20,
        rejectedQuantity: 0,
        landedUnitCost: "12.1750",
      },
      {
        receiptId: receipt.id,
        shipmentLineId: partialShipmentLines[1]!.id,
        acceptedQuantity: 400,
        damagedQuantity: 0,
        rejectedQuantity: 0,
        landedUnitCost: "18.1938",
      },
    ]);
    await db.insert(supplyInventoryMovementsTable).values([
      {
        productId: supplyProducts[4]!.id,
        movementType: "receipt",
        quantity: 700,
        unitCost: "12.1750",
        referenceType: "receipt",
        referenceId: receipt.id,
      },
      {
        productId: supplyProducts[4]!.id,
        movementType: "damage",
        quantity: -20,
        unitCost: "12.1750",
        referenceType: "receipt",
        referenceId: receipt.id,
      },
      {
        productId: supplyProducts[5]!.id,
        movementType: "receipt",
        quantity: 400,
        unitCost: "18.1938",
        referenceType: "receipt",
        referenceId: receipt.id,
      },
    ]);
    await db.insert(supplyVendorBillsTable).values([
      {
        billNumber: "BILL-260604",
        purchaseOrderId: partialPo.id,
        vendorInvoiceNumber: "SCL-88210",
        invoiceDate: "2026-06-04",
        amount: "9957.00",
        status: "matched",
        matchedAt: new Date("2026-06-04T16:00:00Z"),
      },
      {
        billNumber: "BILL-260602",
        purchaseOrderId: issuedPo.id,
        vendorInvoiceNumber: "MPG-44182",
        invoiceDate: "2026-06-02",
        amount: "31420.00",
        status: "exception",
      },
    ]);
    await db.insert(supplyActivityEventsTable).values([
      {
        entityType: "purchase_order",
        entityId: draftPo.id,
        eventType: "created",
        summary: "PO-260601 draft created for seasonal replenishment",
        actorName: "Taylor Reed",
      },
      {
        entityType: "shipment",
        entityId: issuedShipment.id,
        eventType: "departed",
        summary: "SHP-260527 departed Monterrey",
        actorName: "System",
      },
      {
        entityType: "receipt",
        entityId: receipt.id,
        eventType: "confirmed",
        summary: "REC-260604 confirmed with a damage discrepancy",
        actorName: "Morgan Hill",
      },
    ]);
  }

  return {
    products: insertedProducts,
    promotions: insertedPromotions.length,
    supplyVendors: insertedSupplyVendors.length,
    supplyShipments: shipmentRows.length,
    supplyCostingRows: supplyCostingRows.length,
  };
}

async function seedCompanyDemoData(products: ProductRecord[]): Promise<{
  users: number;
  salesReps: number;
  customers: number;
  orders: number;
  orderItems: number;
  invoices: number;
  collaborativeTasks: number;
  posterPosts: number;
}> {
  const insertedReps = await db
    .insert(salesRepsTable)
    .values(buildRepRows())
    .returning();
  const insertedUsers = await db
    .insert(usersTable)
    .values([
      {
        name: "Morris Setton",
        email: "morris.setton@clarity.local",
        phone: "(212) 555-0100",
        loginPin: "2468",
        title: "Main Administrator",
        role: "admin",
        status: "active",
        lastActiveAt: new Date(),
        lastLoginAt: new Date(),
      },
      ...insertedReps.map((rep, index) => ({
        salesRepId: rep.id,
        name: rep.name,
        email: rep.email!,
        phone: `(555) ${String(210 + index).padStart(3, "0")}-${String(1100 + index * 37).padStart(4, "0")}`,
        loginPin: "2468",
        title:
          index === 0 ? "Senior Sales Representative" : "Sales Representative",
        role: "sales_rep",
        status: "active",
        lastActiveAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
        lastLoginAt:
          index < 4
            ? new Date(Date.now() - (index + 1) * 60 * 60 * 1000)
            : null,
      })),
    ])
    .returning();
  const insertedCustomers = await db
    .insert(customersTable)
    .values(buildCustomerRows(insertedReps.map((rep) => rep.id)))
    .returning();

  await db.insert(customerContactsTable).values(
    buildCustomerContacts(
      insertedCustomers.map((customer) => ({
        id: customer.id,
        companyName: customer.companyName,
        primaryContactName: customer.primaryContactName,
        email: customer.email,
        phone: customer.phone,
      })),
    ),
  );
  await db.insert(customerActivitiesTable).values(
    buildCustomerActivities(
      insertedCustomers.map((customer) => ({
        id: customer.id,
        companyName: customer.companyName,
        primaryContactName: customer.primaryContactName,
        status: customer.status,
        customerSinceDate: customer.customerSinceDate,
      })),
    ),
  );

  let ordersInserted = 0;
  let invoicesInserted = 0;
  let itemsInserted = 0;

  const monthlyBuckets = monthRange(2025, 0, 2026, 5);
  const productRotation = shuffle(products);
  let productCursor = 0;

  for (const { year, monthIndex } of monthlyBuckets) {
    const orderCount = buildMonthlyOrderCounts(year, monthIndex);
    const dayCap = daysInMonth(year, monthIndex);
    const maxDay = year === 2026 && monthIndex === 5 ? 5 : dayCap;

    for (let orderIndex = 0; orderIndex < orderCount; orderIndex += 1) {
      const customer = pickWeightedCustomer(insertedCustomers);
      const orderDate = utcDate(year, monthIndex, int(1, maxDay));
      const shippingMethod = pick(shippingMethods);
      const shippingCost = chance(0.5) ? "0.00" : money(int(8, 49) + random());
      const status = chooseStatus();
      const lineItemCount = Math.min(
        products.length,
        int(2, Math.min(6, products.length)),
      );
      const selectedProducts: ProductRecord[] = [];

      while (selectedProducts.length < lineItemCount) {
        const product =
          productRotation[productCursor % productRotation.length]!;
        productCursor += 1;
        if (!selectedProducts.some((selected) => selected.id === product.id)) {
          selectedProducts.push(product);
        }
      }

      let subtotal = 0;
      const computedItems: Array<Omit<OrderItemRow, "orderId">> = [];
      for (const product of selectedProducts) {
        const quantity = int(1, 18);
        const unitPrice = Number(product.unitPrice);
        const lineTotal = money(unitPrice * quantity);
        subtotal += unitPrice * quantity;
        computedItems.push({
          productId: product.id,
          quantity,
          unitPrice: money(unitPrice),
          discountAmount: "0.00",
          lineTotal,
          promotionName: null,
        });
      }

      const repId =
        customer.repId ??
        insertedReps[int(0, insertedReps.length - 1)]?.id ??
        null;
      const total = subtotal + Number(shippingCost);
      const [order] = await db
        .insert(ordersTable)
        .values({
          orderNumber: `ORD-${year}${String(monthIndex + 1).padStart(2, "0")}-${String(orderIndex + 1).padStart(3, "0")}`,
          customerId: customer.id,
          repId,
          status,
          subtotal: money(subtotal),
          discountTotal: "0.00",
          shippingCost,
          total: money(total),
          shippingMethod,
          trackingNumber:
            status === "in_transit" || status === "fulfilled"
              ? `TRK${year}${monthIndex + 1}${orderIndex + 1}`
              : null,
          customTerms: customer.customTerms ?? null,
          orderDate,
        })
        .returning();

      const orderItemRows = computedItems.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        lineTotal: item.lineTotal,
        promotionName: item.promotionName,
      }));
      await db.insert(orderItemsTable).values(orderItemRows);
      ordersInserted += 1;
      itemsInserted += orderItemRows.length;

      if (status === "fulfilled") {
        const isPaid = chance(0.7);
        const amount = money(total);
        const amountPaid = isPaid
          ? amount
          : money(Math.max(0, total * (chance(0.55) ? int(15, 75) / 100 : 0)));
        const invoiceRow: InvoiceRow = {
          invoiceNumber: `INV-${year}${String(monthIndex + 1).padStart(2, "0")}-${String(orderIndex + 1).padStart(3, "0")}`,
          customerId: customer.id,
          orderId: order.id,
          amount,
          amountPaid,
          dueDate: dateOnly(addDays(orderDate, int(15, 45))),
          invoiceDate: dateOnly(orderDate),
          isPaid,
          notes: customer.customTerms ?? "Net 30",
        };
        await db.insert(invoicesTable).values(invoiceRow);
        invoicesInserted += 1;
      }
    }
  }

  const usersByEmail = new Map(insertedUsers.map((user) => [user.email, user]));
  const morris = usersByEmail.get("morris.setton@clarity.local");
  const avaRodriguez = usersByEmail.get("ava.rodriguez@clarity.local");
  const danielKim = usersByEmail.get("daniel.kim@clarity.local");
  const sofiaPatel = usersByEmail.get("sofia.patel@clarity.local");
  const marcusJohnson = usersByEmail.get("marcus.johnson@clarity.local");

  const collaborationTasks: CollaborativeTaskRow[] =
    morris && avaRodriguez && danielKim && sofiaPatel && marcusJohnson
      ? [
          {
            title: "Prep Northeast reorder call",
            notes:
              "Review June pipeline and sync with @Ava Rodriguez before tomorrow's pricing review.",
            priority: "high",
            category: "Accounts",
            createdByUserId: morris.id,
          },
          {
            title: "Update hospital forecast assumptions",
            notes:
              "Share any blocked SKUs with @Daniel Kim and add revised volume guidance.",
            priority: "medium",
            category: "Forecast",
            createdByUserId: morris.id,
          },
          {
            title: "Confirm Friday launch checklist",
            notes:
              "Need launch notes from @Sofia Patel and shipping timing from @Marcus Johnson.",
            priority: "high",
            category: "Internal",
            createdByUserId: morris.id,
          },
        ]
      : [];

  const insertedTasks =
    collaborationTasks.length > 0
      ? await db
          .insert(collaborativeTasksTable)
          .values(collaborationTasks)
          .returning()
      : [];

  if (
    insertedTasks.length > 0 &&
    morris &&
    avaRodriguez &&
    danielKim &&
    sofiaPatel &&
    marcusJohnson
  ) {
    await db.insert(taskAssignmentsTable).values([
      {
        taskId: insertedTasks[0]!.id,
        userId: avaRodriguez.id,
        assignmentSource: "mention",
      },
      {
        taskId: insertedTasks[0]!.id,
        userId: morris.id,
        assignmentSource: "creator",
      },
      {
        taskId: insertedTasks[1]!.id,
        userId: danielKim.id,
        assignmentSource: "mention",
      },
      {
        taskId: insertedTasks[1]!.id,
        userId: morris.id,
        assignmentSource: "creator",
      },
      {
        taskId: insertedTasks[2]!.id,
        userId: sofiaPatel.id,
        assignmentSource: "mention",
      },
      {
        taskId: insertedTasks[2]!.id,
        userId: marcusJohnson.id,
        assignmentSource: "mention",
      },
      {
        taskId: insertedTasks[2]!.id,
        userId: morris.id,
        assignmentSource: "creator",
      },
    ]);
  }

  const posterPosts: PosterPostRow[] =
    morris && avaRodriguez
      ? [
          {
            postType: "headline",
            title: "Quarter close rehearsal at 4 PM",
            body: "Please come prepared with account risks, promo asks, and any supply issues that will affect the final week of the month.",
            includeAllUsers: true,
            createdByUserId: morris.id,
          },
          {
            postType: "reminder",
            title: "Ava Rodriguez onboarding support",
            body: "Pair with Ava on the first Northeast reorder call and drop any customer notes into the task thread before end of day.",
            includeAllUsers: false,
            createdByUserId: morris.id,
          },
        ]
      : [];

  const insertedPosts =
    posterPosts.length > 0
      ? await db.insert(posterPostsTable).values(posterPosts).returning()
      : [];

  if (insertedPosts.length > 1 && avaRodriguez) {
    await db.insert(posterPostTargetsTable).values([
      {
        postId: insertedPosts[1]!.id,
        userId: avaRodriguez.id,
      },
    ]);
  }

  return {
    users: insertedUsers.length,
    salesReps: insertedReps.length,
    customers: insertedCustomers.length,
    orders: ordersInserted,
    orderItems: itemsInserted,
    invoices: invoicesInserted,
    collaborativeTasks: insertedTasks.length,
    posterPosts: insertedPosts.length,
  };
}

async function main(): Promise<void> {
  const mode = parseSeedMode();
  console.log(
    mode === "full"
      ? "Resetting all demo tables..."
      : "Resetting company demo tables and preserving catalog...",
  );

  let productSummary = {
    products: 0,
    promotions: 0,
    supplyVendors: 0,
    supplyShipments: 0,
    supplyCostingRows: 0,
  };
  let productsForOrders: ProductRecord[] = [];

  if (mode === "full") {
    await resetAllDemoTables();
    const catalogSummary = await seedCatalogAndSupply();
    productSummary = {
      products: catalogSummary.products.length,
      promotions: catalogSummary.promotions,
      supplyVendors: catalogSummary.supplyVendors,
      supplyShipments: catalogSummary.supplyShipments,
      supplyCostingRows: catalogSummary.supplyCostingRows,
    };
    productsForOrders = catalogSummary.products;
  } else {
    await resetCompanyDemoTables();
    productsForOrders = await db.select().from(productsTable);
    if (productsForOrders.length === 0) {
      throw new Error(
        'No catalog products found. Run "pnpm --filter @workspace/scripts seed" first.',
      );
    }
    const [promotionCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(promotionsTable);
    const [vendorCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(supplyVendorsTable);
    const [shipmentCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(supplyShipmentsTable);
    const [costingCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(supplyInventoryCostingTable);
    productSummary = {
      products: productsForOrders.length,
      promotions: Number(promotionCountRow?.count ?? 0),
      supplyVendors: Number(vendorCountRow?.count ?? 0),
      supplyShipments: Number(shipmentCountRow?.count ?? 0),
      supplyCostingRows: Number(costingCountRow?.count ?? 0),
    };
  }

  const companySummary = await seedCompanyDemoData(productsForOrders);

  console.log("Seed complete.");
  console.log(
    JSON.stringify(
      {
        mode,
        users: companySummary.users,
        salesReps: companySummary.salesReps,
        products: productSummary.products,
        customers: companySummary.customers,
        promotions: productSummary.promotions,
        supplyVendors: productSummary.supplyVendors,
        supplyShipments: productSummary.supplyShipments,
        supplyCostingRows: productSummary.supplyCostingRows,
        orders: companySummary.orders,
        orderItems: companySummary.orderItems,
        invoices: companySummary.invoices,
        collaborativeTasks: companySummary.collaborativeTasks,
        posterPosts: companySummary.posterPosts,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seeding failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
