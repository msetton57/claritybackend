export type ProcurementStatus =
  | "draft"
  | "issued"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled";

export interface ProductOption {
  id: number;
  sku: string;
  name: string;
  unitPrice: number;
}

export interface Vendor {
  id: number;
  name: string;
  vendorCode: string;
  primaryContactName: string;
  email: string;
  phone: string | null;
  leadTimeDays: number;
  onTimeDeliveryPct: string | number;
  qualityRating: string | number;
  shipmentCount: number;
  totalSpend: number;
  averageLeadTimeDays?: number;
  fillRatePct?: number;
  delayedShipmentCount?: number;
  openPurchaseOrders?: number;
  costChangePct?: number | null;
}

export interface PurchaseOrderLine {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
  remainingQuantity: number;
  availableToShipQuantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorId: number;
  vendorName: string;
  status: ProcurementStatus;
  orderDate: string;
  expectedDate: string | null;
  destination: string;
  paymentTerms: string;
  notes: string | null;
  total: number;
  lines: PurchaseOrderLine[];
}

export interface ShipmentLine {
  id: number;
  purchaseOrderLineId: number;
  sku: string;
  productName: string;
  quantity: number;
  processedQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  allocatedLandedCost: number;
}

export interface Shipment {
  id: number;
  shipmentNumber: string;
  purchaseOrderId: number;
  poNumber: string;
  vendorName: string;
  status: string;
  origin: string;
  destination: string;
  departureDate: string | null;
  eta: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  containerNumber: string | null;
  notes: string | null;
  sharedCosts: number;
  productValue: number;
  lines: ShipmentLine[];
}

export interface InventoryCost {
  id: number;
  sku: string;
  productName: string;
  category: string;
  vendorName: string | null;
  onHand: number;
  allocatedQuantity: number;
  availableQuantity: number;
  sellingPrice: number;
  averageCost: number;
  lastPurchaseCost: number;
  incomingUnits: number;
  incomingCost: number | null;
  projectedMargin: number | null;
  openPurchaseOrderQuantity: number;
  averageMonthlyUsage: number;
  dailyUsage: number;
  daysRemaining: number | null;
  safetyStock: number;
  reorderPoint: number;
  inventoryStatus: "healthy" | "reorder_soon" | "critical" | "overstock";
  projectedStockoutDate: string | null;
  inventoryValue: number;
  lastSaleDate: string | null;
  daysSinceLastSale: number | null;
  overstockQuantity: number;
  usageTrend: Array<{ month: string; quantity: number }>;
  salesTrend: Array<{ month: string; quantity: number; revenue: number }>;
  purchasingTrend: Array<{ month: string; quantity: number; cost: number }>;
}

export interface SupplyReceiptLine {
  id: number;
  shipmentLineId: number;
  acceptedQuantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
  landedUnitCost: number;
}

export interface SupplyReceipt {
  id: number;
  receiptNumber: string;
  shipmentId: number;
  shipmentNumber: string;
  status: string;
  receivedAt: string;
  receivedBy: string;
  discrepancyNotes: string | null;
  confirmedAt: string | null;
  reversedAt: string | null;
  lines: SupplyReceiptLine[];
}

export interface VendorBill {
  id: number;
  billNumber: string;
  purchaseOrderId: number;
  poNumber: string;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  amount: number;
  status: string;
  matchedAt: string | null;
  createdAt: string;
}

export interface SupplyDocument {
  id: number;
  entityType: string;
  entityId: number;
  documentType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface InventoryMovement {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  movementType: string;
  quantity: number;
  unitCost: number;
  referenceType: string;
  referenceId: number;
  notes: string | null;
  createdAt: string;
}

export interface PurchasingRecommendation {
  productId: number;
  sku: string;
  productName: string;
  vendorName: string | null;
  availableInventory: number;
  monthlyUsage: number;
  daysRemaining: number | null;
  safetyStock: number;
  leadTimeDays: number;
  quantityAlreadyOnOrder: number;
  projectedStockoutDate: string | null;
  recommendedPurchaseQuantity: number;
  estimatedPurchaseCost: number;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
}

export interface InboundInventoryItem {
  shipmentId: number;
  shipmentNumber: string;
  vendorName: string;
  purchaseOrderId: number;
  poNumber: string;
  carrier: string | null;
  trackingNumber: string | null;
  eta: string | null;
  status: string;
  quantityExpected: number;
  quantityReceived: number;
  remainingQuantity: number;
  inboundValue: number;
  delayed: boolean;
}

export interface InventoryAlert {
  id: string;
  severity: "critical" | "warning" | "informational";
  title: string;
  description: string;
  entityType: "product" | "shipment" | "purchase_order" | "vendor";
  entityId: number;
  workspace: string;
  sku?: string | null;
  vendorName?: string | null;
}

export interface InventoryRiskItem {
  productId: number;
  sku: string;
  productName: string;
  inventoryValue: number;
  currentInventory: number;
  daysRemaining: number | null;
  projectedStockoutDate: string | null;
  recommendedAction: string;
  lastSaleDate?: string | null;
  daysSinceLastSale?: number | null;
  excessInventoryQuantity?: number;
}

export interface ExecutiveSummary {
  largestRecommendations: PurchasingRecommendation[];
  topInventoryRisks: InventoryAlert[];
  vendorDelays: InboundInventoryItem[];
}

export interface SupplyActivity {
  id: number;
  entityType: string;
  entityId: number;
  eventType: string;
  summary: string;
  actorName: string | null;
  createdAt: string;
}

export interface SupplyStore {
  metrics: Record<string, number>;
  vendors: Vendor[];
  products: ProductOption[];
  purchaseOrders: PurchaseOrder[];
  shipments: Shipment[];
  receipts: SupplyReceipt[];
  bills: VendorBill[];
  inventory: InventoryCost[];
  inventoryMovements: InventoryMovement[];
  documents: SupplyDocument[];
  activities: SupplyActivity[];
  recommendations: PurchasingRecommendation[];
  inboundInventory: InboundInventoryItem[];
  alerts: InventoryAlert[];
  stockoutRisks: InventoryRiskItem[];
  deadInventory: InventoryRiskItem[];
  overstock: InventoryRiskItem[];
  executiveSummary: ExecutiveSummary;
}

export const statusLabel = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const statusTone = (value: string) => {
  if (["received", "closed", "matched"].includes(value))
    return "bg-emerald-500/10 text-emerald-700";
  if (["cancelled", "rejected", "exception"].includes(value))
    return "bg-rose-500/10 text-rose-700";
  if (["partially_received", "warning"].includes(value))
    return "bg-amber-500/10 text-amber-700";
  if (["issued", "created", "in_transit", "delivered"].includes(value))
    return "bg-sky-500/10 text-sky-700";
  return "bg-slate-500/10 text-slate-700";
};
