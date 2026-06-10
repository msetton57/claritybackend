import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ApiError, fetchJson } from "@/lib/http";

type ImportType = "sales-history" | "customer-pos" | "customers";
type ImportMode = "validate" | "commit";

type OrderImportResponse = {
  importedOrders: number;
  importedLines: number;
  notes: string[];
  rowErrors?: string[];
  mode: ImportMode;
};

type CustomerImportResponse = {
  importedCustomers: number;
  notes: string[];
  rowErrors?: string[];
  mode: ImportMode;
};

type ImportResponse = OrderImportResponse | CustomerImportResponse;

type ImportConfig = {
  value: ImportType;
  label: string;
  title: string;
  description: string;
  detail: string;
  endpoint: "/api/imports/orders" | "/api/imports/customers";
  successTitle: string;
  validatingDescription: (result: ImportResponse) => string;
  importingDescription: (result: ImportResponse) => string;
  summaryDescription: (result: ImportResponse) => string;
  rules: string[];
  columns: string[];
};

function describeOrderValidation(result: ImportResponse) {
  if (!("importedOrders" in result)) {
    return `${result.importedCustomers} customers are ready to import.`;
  }
  return `${result.importedOrders} orders and ${result.importedLines} rows are ready to import.`;
}

function describeOrderImport(result: ImportResponse) {
  if (!("importedOrders" in result)) {
    return `${result.importedCustomers} customers were added.`;
  }
  return `${result.importedOrders} orders and ${result.importedLines} rows were added.`;
}

function describeOrderSummary(result: ImportResponse) {
  if (!("importedOrders" in result)) {
    return `${result.importedCustomers} customers ready in this file.`;
  }
  return `${result.importedOrders} orders across ${result.importedLines} rows.`;
}

function describeCustomerValidation(result: ImportResponse) {
  if ("importedCustomers" in result) {
    return `${result.importedCustomers} customers are ready to import.`;
  }
  return `${result.importedOrders} orders and ${result.importedLines} rows are ready to import.`;
}

function describeCustomerImport(result: ImportResponse) {
  if ("importedCustomers" in result) {
    return `${result.importedCustomers} customers were added.`;
  }
  return `${result.importedOrders} orders and ${result.importedLines} rows were added.`;
}

function describeCustomerSummary(result: ImportResponse) {
  if ("importedCustomers" in result) {
    return `${result.importedCustomers} customers ready in this file.`;
  }
  return `${result.importedOrders} orders across ${result.importedLines} rows.`;
}

const importConfigs: ImportConfig[] = [
  {
    value: "sales-history",
    label: "Sales History",
    title: "Import historical sales",
    description:
      "Backfill fulfilled sales so revenue trends and customer history reflect reality.",
    detail:
      "Load historical sales and customer POs with a validate-first CSV workflow so orders appear in the app with fewer surprises.",
    endpoint: "/api/imports/orders",
    successTitle: "Import complete",
    validatingDescription: describeOrderValidation,
    importingDescription: describeOrderImport,
    summaryDescription: describeOrderSummary,
    rules: [
      "Use one row per line item.",
      "Repeat the same order number for every line on the same sale.",
      "Set status to fulfilled for closed sales history unless you want a different lifecycle state.",
      "Customer names must match an existing customer name or company name exactly.",
      "SKUs must already exist in the catalog.",
    ],
    columns: [
      "order_number",
      "customer_name",
      "order_date",
      "status",
      "sku",
      "quantity",
      "unit_price",
      "discount_amount",
      "shipping_cost",
      "shipping_method",
      "tracking_number",
      "custom_terms",
    ],
  },
  {
    value: "customer-pos",
    label: "Customer POs",
    title: "Import customer purchase orders",
    description:
      "Load open customer demand so active orders and supply planning reflect the same PO volume.",
    detail:
      "Load historical sales and customer POs with a validate-first CSV workflow so orders appear in the app with fewer surprises.",
    endpoint: "/api/imports/orders",
    successTitle: "Import complete",
    validatingDescription: describeOrderValidation,
    importingDescription: describeOrderImport,
    summaryDescription: describeOrderSummary,
    rules: [
      "Use the customer's PO number as order_number if that is the main reference you track.",
      "Set status to open for unshipped demand or in_transit if it is already on the water.",
      "Repeat shipping fields only when they apply to the whole order.",
      "Customer names must match an existing customer name or company name exactly.",
      "SKUs must already exist in the catalog.",
    ],
    columns: [
      "order_number",
      "customer_name",
      "order_date",
      "status",
      "sku",
      "quantity",
      "unit_price",
      "discount_amount",
      "shipping_cost",
      "shipping_method",
      "tracking_number",
      "custom_terms",
    ],
  },
  {
    value: "customers",
    label: "Customers",
    title: "Import customers",
    description:
      "Create customer records in bulk from a spreadsheet-ready CSV that your team can download, fill out, and upload back.",
    detail:
      "Download a customer template, complete it offline, then validate and import it back into the CRM.",
    endpoint: "/api/imports/customers",
    successTitle: "Customers imported",
    validatingDescription: describeCustomerValidation,
    importingDescription: describeCustomerImport,
    summaryDescription: describeCustomerSummary,
    rules: [
      "Every cell can be left empty. Text fields stay blank when imported.",
      "If status is filled in, it must be active, prospect, on_hold, or inactive.",
      "If custom_pricing is filled in, it must be true or false.",
      "If rep_name is filled in, it must match an existing sales rep exactly.",
      "If customer_since_date is filled in, it must use YYYY-MM-DD.",
    ],
    columns: [
      "company_name",
      "primary_contact_name",
      "primary_contact_title",
      "email",
      "phone",
      "billing_address",
      "shipping_address",
      "status",
      "payment_terms",
      "credit_limit",
      "custom_pricing",
      "rep_name",
      "customer_since_date",
    ],
  },
];

function getImportConfig(value: ImportType) {
  return importConfigs.find((config) => config.value === value) ?? importConfigs[0];
}

async function readFileText(file: File) {
  return file.text();
}

async function submitImport({
  file,
  importType,
  endpoint,
  mode,
}: {
  file: File;
  importType: ImportType;
  endpoint: ImportConfig["endpoint"];
  mode: ImportMode;
}) {
  const csvText = await readFileText(file);

  return fetchJson<ImportResponse>(endpoint, {
    method: "POST",
    body: JSON.stringify({
      importType,
      fileName: file.name,
      csvText,
      mode,
    }),
  });
}

function getResultCount(result: ImportResponse) {
  if ("importedCustomers" in result) {
    return result.importedCustomers;
  }

  return result.importedOrders;
}

export default function DataImports() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<ImportType>("sales-history");
  const [file, setFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResponse | null>(null);
  const [lastValidatedFileName, setLastValidatedFileName] = useState<string | null>(
    null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);

  const activeConfig = useMemo(() => getImportConfig(tab), [tab]);
  const templateUrl = useMemo(() => `/api/imports/templates/${tab}`, [tab]);
  const isValidatedForCurrentFile =
    file !== null &&
    lastValidatedFileName === file.name &&
    rowErrors.length === 0 &&
    validationError === null;

  async function runImport(mode: ImportMode) {
    if (!file) {
      toast({ title: "Choose a CSV file first", variant: "destructive" });
      return;
    }

    try {
      if (mode === "validate") {
        setIsValidating(true);
      } else {
        setIsImporting(true);
      }

      if (mode === "validate") {
        setLastResult(null);
      }
      setValidationError(null);
      setRowErrors([]);

      const payload = await submitImport({
        file,
        importType: tab,
        endpoint: activeConfig.endpoint,
        mode,
      });
      setLastResult(payload);
      setLastValidatedFileName(file.name);
      setRowErrors(payload.rowErrors ?? []);

      if (mode === "commit") {
        await queryClient.invalidateQueries();
        toast({
          title: activeConfig.successTitle,
          description: activeConfig.importingDescription(payload),
        });
      } else {
        toast({
          title: "Validation passed",
          description: activeConfig.validatingDescription(payload),
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to import this file.";
      setValidationError(message);
      setLastResult(null);
      setLastValidatedFileName(mode === "validate" ? null : lastValidatedFileName);

      if (error instanceof ApiError) {
        const payload = error.details as
          | {
              error?: string;
              rowErrors?: string[];
            }
          | null;
        if (payload) {
          setValidationError(payload.error ?? "Import validation failed");
          setRowErrors(payload.rowErrors ?? []);
        }
      }

      toast({
        title: mode === "validate" ? "Validation failed" : "Import failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (mode === "validate") {
        setIsValidating(false);
      } else {
        setIsImporting(false);
      }
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">
              Data Ops
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Data Imports</h1>
            <p className="mt-1 text-muted-foreground">{activeConfig.detail}</p>
          </div>
          <Badge variant="outline" className="w-fit px-3 py-1 text-sm">
            CSV template workflow
          </Badge>
        </div>

        <Alert>
          <FileSpreadsheet className="size-4" />
          <AlertTitle>Operational import lane</AlertTitle>
          <AlertDescription>
            Validate a file first, fix row-level issues, then commit it when the
            preview is clean.
          </AlertDescription>
        </Alert>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as ImportType);
            setFile(null);
            setLastResult(null);
            setLastValidatedFileName(null);
            setValidationError(null);
            setRowErrors([]);
          }}
        >
          <TabsList>
            {importConfigs.map((config) => (
              <TabsTrigger key={config.value} value={config.value}>
                {config.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {importConfigs.map((config) => (
            <TabsContent key={config.value} value={config.value} className="mt-6">
              <ImportCard
                title={config.title}
                description={config.description}
                templateUrl={templateUrl}
                file={file}
                rules={config.rules}
                columns={config.columns}
                isValidating={isValidating}
                isImporting={isImporting}
                isValidatedForCurrentFile={isValidatedForCurrentFile}
                lastResult={lastResult}
                validationError={validationError}
                rowErrors={rowErrors}
                summaryDescription={config.summaryDescription}
                onFileChange={(nextFile) => {
                  setFile(nextFile);
                  setLastResult(null);
                  setLastValidatedFileName(null);
                  setValidationError(null);
                  setRowErrors([]);
                }}
                onValidate={() => runImport("validate")}
                onImport={() => runImport("commit")}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ImportCard({
  title,
  description,
  templateUrl,
  file,
  rules,
  columns,
  isValidating,
  isImporting,
  isValidatedForCurrentFile,
  lastResult,
  validationError,
  rowErrors,
  summaryDescription,
  onFileChange,
  onValidate,
  onImport,
}: {
  title: string;
  description: string;
  templateUrl: string;
  file: File | null;
  rules: string[];
  columns: string[];
  isValidating: boolean;
  isImporting: boolean;
  isValidatedForCurrentFile: boolean;
  lastResult: ImportResponse | null;
  validationError: string | null;
  rowErrors: string[];
  summaryDescription: (result: ImportResponse) => string;
  onFileChange: (file: File | null) => void;
  onValidate: () => void;
  onImport: () => void;
}) {
  const validatedCount = lastResult ? getResultCount(lastResult) : 0;
  const currentResultIsForUpload =
    lastResult !== null &&
    rowErrors.length === 0 &&
    validationError === null &&
    validatedCount > 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-dashed bg-muted/30 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Start with the template</p>
                <p className="text-sm text-muted-foreground">
                  Download the CSV, keep the headers exactly as provided, then
                  upload your completed file here.
                </p>
              </div>
              <Button asChild variant="outline">
                <a href={templateUrl} download>
                  <Download className="mr-2 size-4" />
                  Download CSV
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="csv-upload">Upload completed CSV</Label>
            <Input
              id="csv-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
            <p className="text-sm text-muted-foreground">
              {file ? `Selected file: ${file.name}` : "No file selected yet."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={onValidate}
              disabled={!file || isValidating || isImporting}
              variant="outline"
              size="lg"
            >
              {isValidating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 size-4" />
              )}
              Validate file
            </Button>
            <Button
              onClick={onImport}
              disabled={!file || !isValidatedForCurrentFile || isImporting || isValidating}
              size="lg"
            >
              {isImporting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              Import data
            </Button>
          </div>

          {!file ? (
            <p className="text-sm text-muted-foreground">
              Choose a file to begin validation.
            </p>
          ) : !isValidatedForCurrentFile ? (
            <p className="text-sm text-muted-foreground">
              Validate this file before importing it into Clarity.
            </p>
          ) : (
            <p className="text-sm text-emerald-700">
              Validation passed for the current file. You can import it now.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Template Rules</CardTitle>
            <CardDescription>
              These keep the import deterministic and easy to reconcile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {rules.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expected Columns</CardTitle>
            <CardDescription>
              Keep the same headers from the downloaded file.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {columns.map((column) => (
              <Badge key={column} variant="secondary">
                {column}
              </Badge>
            ))}
          </CardContent>
        </Card>

        {validationError || rowErrors.length > 0 ? (
          <Card className="border-red-200 bg-red-50/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-900">
                <AlertTriangle className="size-4" />
                Validation issues
              </CardTitle>
              <CardDescription className="text-red-800">
                Fix these rows in the CSV and validate again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-red-900">
              {validationError ? <p>{validationError}</p> : null}
              {rowErrors.slice(0, 12).map((error) => (
                <p key={error}>{error}</p>
              ))}
              {rowErrors.length > 12 ? (
                <p>Plus {rowErrors.length - 12} more row-level issues.</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {currentResultIsForUpload ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader>
              <CardTitle className="text-emerald-900">
                {lastResult?.mode === "validate" ? "Validation summary" : "Latest import summary"}
              </CardTitle>
              <CardDescription className="text-emerald-800">
                {lastResult ? summaryDescription(lastResult) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-emerald-900">
              {lastResult?.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
