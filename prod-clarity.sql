--
-- PostgreSQL database dump
--

\restrict psGKLJC9CK7h24wvjT4UuEV9xuwLeNn78srP7WcXsoUx8GmuXhuysUfR8RAHEH6

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.auth_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auth_sessions OWNER TO morris;

--
-- Name: auth_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.auth_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auth_sessions_id_seq OWNER TO morris;

--
-- Name: auth_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.auth_sessions_id_seq OWNED BY public.auth_sessions.id;


--
-- Name: collaborative_tasks; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.collaborative_tasks (
    id integer NOT NULL,
    title text NOT NULL,
    notes text,
    priority text DEFAULT 'medium'::text NOT NULL,
    category text DEFAULT 'Follow-up'::text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    created_by_user_id integer NOT NULL,
    completed_by_user_id integer,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.collaborative_tasks OWNER TO morris;

--
-- Name: collaborative_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.collaborative_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.collaborative_tasks_id_seq OWNER TO morris;

--
-- Name: collaborative_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.collaborative_tasks_id_seq OWNED BY public.collaborative_tasks.id;


--
-- Name: customer_account_actions; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.customer_account_actions (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    action_type text NOT NULL,
    title text NOT NULL,
    details text,
    previous_value text,
    next_value text,
    created_by text DEFAULT 'Clarity'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_account_actions OWNER TO morris;

--
-- Name: customer_account_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.customer_account_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_account_actions_id_seq OWNER TO morris;

--
-- Name: customer_account_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.customer_account_actions_id_seq OWNED BY public.customer_account_actions.id;


--
-- Name: customer_activities; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.customer_activities (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    activity_type text NOT NULL,
    subject text NOT NULL,
    details text,
    outcome text,
    due_date text,
    is_completed boolean DEFAULT false NOT NULL,
    created_by text DEFAULT 'Sales Team'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_activities OWNER TO morris;

--
-- Name: customer_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.customer_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_activities_id_seq OWNER TO morris;

--
-- Name: customer_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.customer_activities_id_seq OWNED BY public.customer_activities.id;


--
-- Name: customer_contacts; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.customer_contacts (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    name text NOT NULL,
    title text,
    email text,
    phone text,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_contacts OWNER TO morris;

--
-- Name: customer_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.customer_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_contacts_id_seq OWNER TO morris;

--
-- Name: customer_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.customer_contacts_id_seq OWNED BY public.customer_contacts.id;


--
-- Name: customer_flags; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.customer_flags (
    customer_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_flags OWNER TO morris;

--
-- Name: customer_product_pricing; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.customer_product_pricing (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    product_id integer NOT NULL,
    custom_unit_price numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_product_pricing OWNER TO morris;

--
-- Name: customer_product_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.customer_product_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_product_pricing_id_seq OWNER TO morris;

--
-- Name: customer_product_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.customer_product_pricing_id_seq OWNED BY public.customer_product_pricing.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name text NOT NULL,
    company_name text DEFAULT ''::text NOT NULL,
    primary_contact_name text DEFAULT ''::text NOT NULL,
    email text,
    phone text,
    address text,
    billing_address text,
    shipping_address text,
    status text DEFAULT 'active'::text NOT NULL,
    rep_id integer,
    credit_limit numeric(12,2) DEFAULT 10000.00 NOT NULL,
    custom_pricing boolean DEFAULT false NOT NULL,
    custom_terms text,
    customer_since_date text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO morris;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO morris;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: ekgx_leads; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.ekgx_leads (
    id integer NOT NULL,
    business_name text NOT NULL,
    contact_name text NOT NULL,
    email text,
    phone text,
    submitted_at timestamp without time zone NOT NULL,
    status text DEFAULT 'not_contacted'::text NOT NULL,
    source text DEFAULT 'Facebook'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    last_contact_at timestamp without time zone,
    last_contact_summary text,
    flagged boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ekgx_leads OWNER TO morris;

--
-- Name: ekgx_leads_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.ekgx_leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ekgx_leads_id_seq OWNER TO morris;

--
-- Name: ekgx_leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.ekgx_leads_id_seq OWNED BY public.ekgx_leads.id;


--
-- Name: invoice_activities; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.invoice_activities (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    activity_type text NOT NULL,
    title text NOT NULL,
    details text,
    previous_value text,
    next_value text,
    created_by text DEFAULT 'Clarity'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoice_activities OWNER TO morris;

--
-- Name: invoice_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.invoice_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_activities_id_seq OWNER TO morris;

--
-- Name: invoice_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.invoice_activities_id_seq OWNED BY public.invoice_activities.id;


--
-- Name: invoice_payments; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.invoice_payments (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date text NOT NULL,
    payment_method text,
    reference_number text,
    notes text,
    created_by text DEFAULT 'Clarity'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoice_payments OWNER TO morris;

--
-- Name: invoice_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.invoice_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_payments_id_seq OWNER TO morris;

--
-- Name: invoice_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.invoice_payments_id_seq OWNED BY public.invoice_payments.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    invoice_number text NOT NULL,
    customer_id integer NOT NULL,
    order_id integer,
    amount numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0.00 NOT NULL,
    due_date text NOT NULL,
    invoice_date text NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    collections_status text DEFAULT 'current'::text NOT NULL,
    last_payment_date text,
    promised_payment_date text,
    promise_note text,
    dispute_reason text,
    write_off_reason text,
    external_ref text,
    sync_status text DEFAULT 'not_synced'::text NOT NULL,
    sync_error text,
    last_synced_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO morris;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoices_id_seq OWNER TO morris;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: order_activities; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.order_activities (
    id integer NOT NULL,
    order_id integer NOT NULL,
    activity_type text NOT NULL,
    title text NOT NULL,
    details text,
    previous_value text,
    next_value text,
    created_by text DEFAULT 'Clarity'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_activities OWNER TO morris;

--
-- Name: order_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.order_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_activities_id_seq OWNER TO morris;

--
-- Name: order_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.order_activities_id_seq OWNED BY public.order_activities.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0.00 NOT NULL,
    line_total numeric(12,2) NOT NULL,
    promotion_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_items OWNER TO morris;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO morris;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_number text NOT NULL,
    customer_id integer NOT NULL,
    rep_id integer,
    status text DEFAULT 'open'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0.00 NOT NULL,
    discount_total numeric(12,2) DEFAULT 0.00 NOT NULL,
    shipping_cost numeric(10,2) DEFAULT 0.00 NOT NULL,
    total numeric(12,2) DEFAULT 0.00 NOT NULL,
    shipping_policy_id integer,
    shipping_carrier text,
    shipping_method text,
    tracking_number text,
    custom_terms text,
    fulfillment_status text DEFAULT 'pending'::text NOT NULL,
    fulfillment_progress integer DEFAULT 0 NOT NULL,
    invoice_status text DEFAULT 'draft'::text NOT NULL,
    risk_level text DEFAULT 'normal'::text NOT NULL,
    last_action_at timestamp without time zone,
    order_date timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.orders OWNER TO morris;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO morris;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: poster_post_targets; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.poster_post_targets (
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.poster_post_targets OWNER TO morris;

--
-- Name: poster_posts; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.poster_posts (
    id integer NOT NULL,
    post_type text DEFAULT 'announcement'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    include_all_users boolean DEFAULT false NOT NULL,
    created_by_user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.poster_posts OWNER TO morris;

--
-- Name: poster_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.poster_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.poster_posts_id_seq OWNER TO morris;

--
-- Name: poster_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.poster_posts_id_seq OWNED BY public.poster_posts.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.products (
    id integer NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    description text,
    unit_price numeric(10,2) NOT NULL,
    inventory_qty integer DEFAULT 0 NOT NULL,
    average_cost numeric(12,4) DEFAULT 0.0000 NOT NULL,
    last_purchase_cost numeric(12,4) DEFAULT 0.0000 NOT NULL,
    eta_date text,
    image_url text,
    pack_size text,
    certifications text[] DEFAULT '{}'::text[] NOT NULL,
    brochure_url text,
    info_sheet_url text,
    archived boolean DEFAULT false NOT NULL,
    archive_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO morris;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO morris;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: promotion_products; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.promotion_products (
    id integer NOT NULL,
    promotion_id integer NOT NULL,
    product_id integer NOT NULL
);


ALTER TABLE public.promotion_products OWNER TO morris;

--
-- Name: promotion_products_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.promotion_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promotion_products_id_seq OWNER TO morris;

--
-- Name: promotion_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.promotion_products_id_seq OWNED BY public.promotion_products.id;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.promotions (
    id integer NOT NULL,
    name text NOT NULL,
    discount_type text DEFAULT 'percent'::text NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    start_date text,
    end_date text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.promotions OWNER TO morris;

--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promotions_id_seq OWNER TO morris;

--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;


--
-- Name: sales_opportunities; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.sales_opportunities (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'New lead'::text NOT NULL,
    source text DEFAULT 'existing_customer'::text NOT NULL,
    lifecycle text DEFAULT 'open'::text NOT NULL,
    due_date text,
    notes text,
    last_contacted_at timestamp without time zone,
    last_contact_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sales_opportunities OWNER TO morris;

--
-- Name: sales_opportunities_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.sales_opportunities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_opportunities_id_seq OWNER TO morris;

--
-- Name: sales_opportunities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.sales_opportunities_id_seq OWNED BY public.sales_opportunities.id;


--
-- Name: sales_reps; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.sales_reps (
    id integer NOT NULL,
    name text NOT NULL,
    email text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sales_reps OWNER TO morris;

--
-- Name: sales_reps_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.sales_reps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_reps_id_seq OWNER TO morris;

--
-- Name: sales_reps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.sales_reps_id_seq OWNED BY public.sales_reps.id;


--
-- Name: shipping_policies; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.shipping_policies (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    carrier text,
    shipping_method text NOT NULL,
    shipping_cost numeric(10,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shipping_policies OWNER TO morris;

--
-- Name: shipping_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.shipping_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipping_policies_id_seq OWNER TO morris;

--
-- Name: shipping_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.shipping_policies_id_seq OWNED BY public.shipping_policies.id;


--
-- Name: supply_activity_events; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_activity_events (
    id integer NOT NULL,
    entity_type text NOT NULL,
    entity_id integer NOT NULL,
    event_type text NOT NULL,
    summary text NOT NULL,
    actor_name text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_activity_events OWNER TO morris;

--
-- Name: supply_activity_events_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_activity_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_activity_events_id_seq OWNER TO morris;

--
-- Name: supply_activity_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_activity_events_id_seq OWNED BY public.supply_activity_events.id;


--
-- Name: supply_documents; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_documents (
    id integer NOT NULL,
    entity_type text NOT NULL,
    entity_id integer NOT NULL,
    document_type text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    checksum text NOT NULL,
    content_base64 text NOT NULL,
    uploaded_by text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_documents OWNER TO morris;

--
-- Name: supply_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_documents_id_seq OWNER TO morris;

--
-- Name: supply_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_documents_id_seq OWNED BY public.supply_documents.id;


--
-- Name: supply_inventory_costing; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_inventory_costing (
    id integer NOT NULL,
    sku text NOT NULL,
    product_name text NOT NULL,
    current_inventory integer DEFAULT 0 NOT NULL,
    current_average_cost numeric(12,2) DEFAULT 0.00 NOT NULL,
    last_purchase_cost numeric(12,2) DEFAULT 0.00 NOT NULL,
    incoming_landed_cost numeric(12,2) DEFAULT 0.00 NOT NULL,
    selling_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_inventory_costing OWNER TO morris;

--
-- Name: supply_inventory_costing_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_inventory_costing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_inventory_costing_id_seq OWNER TO morris;

--
-- Name: supply_inventory_costing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_inventory_costing_id_seq OWNED BY public.supply_inventory_costing.id;


--
-- Name: supply_inventory_movements; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_inventory_movements (
    id integer NOT NULL,
    product_id integer NOT NULL,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric(12,4) DEFAULT 0.0000 NOT NULL,
    reference_type text NOT NULL,
    reference_id integer NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_inventory_movements OWNER TO morris;

--
-- Name: supply_inventory_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_inventory_movements_id_seq OWNER TO morris;

--
-- Name: supply_inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_inventory_movements_id_seq OWNED BY public.supply_inventory_movements.id;


--
-- Name: supply_procurement_shipments; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_procurement_shipments (
    id integer NOT NULL,
    shipment_number text NOT NULL,
    purchase_order_id integer NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    origin text NOT NULL,
    destination text NOT NULL,
    departure_date text,
    eta text,
    carrier text,
    tracking_number text,
    container_number text,
    freight_cost numeric(14,2) DEFAULT 0.00 NOT NULL,
    customs_and_duties numeric(14,2) DEFAULT 0.00 NOT NULL,
    brokerage_fees numeric(14,2) DEFAULT 0.00 NOT NULL,
    drayage numeric(14,2) DEFAULT 0.00 NOT NULL,
    warehouse_receiving_costs numeric(14,2) DEFAULT 0.00 NOT NULL,
    miscellaneous_costs numeric(14,2) DEFAULT 0.00 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_procurement_shipments OWNER TO morris;

--
-- Name: supply_procurement_shipments_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_procurement_shipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_procurement_shipments_id_seq OWNER TO morris;

--
-- Name: supply_procurement_shipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_procurement_shipments_id_seq OWNED BY public.supply_procurement_shipments.id;


--
-- Name: supply_purchase_order_lines; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_purchase_order_lines (
    id integer NOT NULL,
    purchase_order_id integer NOT NULL,
    product_id integer NOT NULL,
    ordered_quantity integer NOT NULL,
    unit_cost numeric(12,4) NOT NULL,
    received_quantity integer DEFAULT 0 NOT NULL,
    damaged_quantity integer DEFAULT 0 NOT NULL,
    rejected_quantity integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.supply_purchase_order_lines OWNER TO morris;

--
-- Name: supply_purchase_order_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_purchase_order_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_purchase_order_lines_id_seq OWNER TO morris;

--
-- Name: supply_purchase_order_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_purchase_order_lines_id_seq OWNED BY public.supply_purchase_order_lines.id;


--
-- Name: supply_purchase_orders; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_purchase_orders (
    id integer NOT NULL,
    po_number text NOT NULL,
    vendor_id integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    order_date text NOT NULL,
    expected_date text,
    destination text DEFAULT 'Main Warehouse'::text NOT NULL,
    payment_terms text DEFAULT 'Net 30'::text NOT NULL,
    notes text,
    issued_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_purchase_orders OWNER TO morris;

--
-- Name: supply_purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_purchase_orders_id_seq OWNER TO morris;

--
-- Name: supply_purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_purchase_orders_id_seq OWNED BY public.supply_purchase_orders.id;


--
-- Name: supply_receipt_lines; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_receipt_lines (
    id integer NOT NULL,
    receipt_id integer NOT NULL,
    shipment_line_id integer NOT NULL,
    accepted_quantity integer DEFAULT 0 NOT NULL,
    damaged_quantity integer DEFAULT 0 NOT NULL,
    rejected_quantity integer DEFAULT 0 NOT NULL,
    landed_unit_cost numeric(12,4) DEFAULT 0.0000 NOT NULL,
    inventory_qty_before integer,
    average_cost_before numeric(12,4),
    last_purchase_cost_before numeric(12,4)
);


ALTER TABLE public.supply_receipt_lines OWNER TO morris;

--
-- Name: supply_receipt_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_receipt_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_receipt_lines_id_seq OWNER TO morris;

--
-- Name: supply_receipt_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_receipt_lines_id_seq OWNED BY public.supply_receipt_lines.id;


--
-- Name: supply_receipts; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_receipts (
    id integer NOT NULL,
    receipt_number text NOT NULL,
    shipment_id integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    received_at timestamp without time zone DEFAULT now() NOT NULL,
    received_by text NOT NULL,
    discrepancy_notes text,
    confirmed_at timestamp without time zone,
    reversed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_receipts OWNER TO morris;

--
-- Name: supply_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_receipts_id_seq OWNER TO morris;

--
-- Name: supply_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_receipts_id_seq OWNED BY public.supply_receipts.id;


--
-- Name: supply_shipment_lines; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_shipment_lines (
    id integer NOT NULL,
    shipment_id integer NOT NULL,
    purchase_order_line_id integer NOT NULL,
    quantity integer NOT NULL,
    allocated_landed_cost numeric(14,4) DEFAULT 0.0000 NOT NULL,
    allocation_override boolean DEFAULT false NOT NULL
);


ALTER TABLE public.supply_shipment_lines OWNER TO morris;

--
-- Name: supply_shipment_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_shipment_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_shipment_lines_id_seq OWNER TO morris;

--
-- Name: supply_shipment_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_shipment_lines_id_seq OWNED BY public.supply_shipment_lines.id;


--
-- Name: supply_shipments; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_shipments (
    id integer NOT NULL,
    shipment_id text NOT NULL,
    vendor_id integer NOT NULL,
    origin text NOT NULL,
    destination text NOT NULL,
    departure_date text NOT NULL,
    eta text NOT NULL,
    status text NOT NULL,
    tracking_number text NOT NULL,
    purchase_order_number text NOT NULL,
    container_number text NOT NULL,
    sku_count integer DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    product_cost numeric(14,2) DEFAULT 0.00 NOT NULL,
    freight_cost numeric(14,2) DEFAULT 0.00 NOT NULL,
    customs_and_duties numeric(14,2) DEFAULT 0.00 NOT NULL,
    brokerage_fees numeric(14,2) DEFAULT 0.00 NOT NULL,
    drayage numeric(14,2) DEFAULT 0.00 NOT NULL,
    warehouse_receiving_costs numeric(14,2) DEFAULT 0.00 NOT NULL,
    miscellaneous_costs numeric(14,2) DEFAULT 0.00 NOT NULL,
    notes text,
    documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    timeline text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_shipments OWNER TO morris;

--
-- Name: supply_shipments_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_shipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_shipments_id_seq OWNER TO morris;

--
-- Name: supply_shipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_shipments_id_seq OWNED BY public.supply_shipments.id;


--
-- Name: supply_vendor_bills; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_vendor_bills (
    id integer NOT NULL,
    bill_number text NOT NULL,
    purchase_order_id integer NOT NULL,
    vendor_invoice_number text NOT NULL,
    invoice_date text NOT NULL,
    amount numeric(14,2) NOT NULL,
    status text DEFAULT 'unmatched'::text NOT NULL,
    matched_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_vendor_bills OWNER TO morris;

--
-- Name: supply_vendor_bills_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_vendor_bills_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_vendor_bills_id_seq OWNER TO morris;

--
-- Name: supply_vendor_bills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_vendor_bills_id_seq OWNED BY public.supply_vendor_bills.id;


--
-- Name: supply_vendors; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.supply_vendors (
    id integer NOT NULL,
    name text NOT NULL,
    vendor_code text NOT NULL,
    primary_contact_name text NOT NULL,
    email text NOT NULL,
    phone text,
    lead_time_days integer DEFAULT 0 NOT NULL,
    on_time_delivery_pct numeric(5,2) DEFAULT 0.00 NOT NULL,
    shipment_count integer DEFAULT 0 NOT NULL,
    total_spend numeric(14,2) DEFAULT 0.00 NOT NULL,
    quality_rating numeric(3,1) DEFAULT 0.0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supply_vendors OWNER TO morris;

--
-- Name: supply_vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.supply_vendors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_vendors_id_seq OWNER TO morris;

--
-- Name: supply_vendors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.supply_vendors_id_seq OWNED BY public.supply_vendors.id;


--
-- Name: task_assignments; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.task_assignments (
    task_id integer NOT NULL,
    user_id integer NOT NULL,
    assignment_source text DEFAULT 'mention'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_assignments OWNER TO morris;

--
-- Name: users; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.users (
    id integer NOT NULL,
    sales_rep_id integer,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    login_pin text DEFAULT '2468'::text NOT NULL,
    title text DEFAULT 'Sales Representative'::text NOT NULL,
    role text DEFAULT 'sales_rep'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_active_at timestamp without time zone,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    password_hash text NOT NULL,
    password_reset_required boolean DEFAULT true NOT NULL
);


ALTER TABLE public.users OWNER TO morris;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO morris;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: workspace_action_points; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.workspace_action_points (
    id integer NOT NULL,
    user_id integer NOT NULL,
    customer_id integer NOT NULL,
    title text NOT NULL,
    details text DEFAULT ''::text NOT NULL,
    due_date text,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_action_points OWNER TO morris;

--
-- Name: workspace_action_points_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.workspace_action_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspace_action_points_id_seq OWNER TO morris;

--
-- Name: workspace_action_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.workspace_action_points_id_seq OWNED BY public.workspace_action_points.id;


--
-- Name: workspace_documents; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.workspace_documents (
    id integer NOT NULL,
    folder_id integer,
    title text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    description text,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    checksum text NOT NULL,
    content_base64 text NOT NULL,
    uploaded_by text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_documents OWNER TO morris;

--
-- Name: workspace_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.workspace_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspace_documents_id_seq OWNER TO morris;

--
-- Name: workspace_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.workspace_documents_id_seq OWNED BY public.workspace_documents.id;


--
-- Name: workspace_folders; Type: TABLE; Schema: public; Owner: morris
--

CREATE TABLE public.workspace_folders (
    id integer NOT NULL,
    name text NOT NULL,
    parent_id integer,
    created_by text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_folders OWNER TO morris;

--
-- Name: workspace_folders_id_seq; Type: SEQUENCE; Schema: public; Owner: morris
--

CREATE SEQUENCE public.workspace_folders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspace_folders_id_seq OWNER TO morris;

--
-- Name: workspace_folders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: morris
--

ALTER SEQUENCE public.workspace_folders_id_seq OWNED BY public.workspace_folders.id;


--
-- Name: auth_sessions id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.auth_sessions ALTER COLUMN id SET DEFAULT nextval('public.auth_sessions_id_seq'::regclass);


--
-- Name: collaborative_tasks id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.collaborative_tasks ALTER COLUMN id SET DEFAULT nextval('public.collaborative_tasks_id_seq'::regclass);


--
-- Name: customer_account_actions id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_account_actions ALTER COLUMN id SET DEFAULT nextval('public.customer_account_actions_id_seq'::regclass);


--
-- Name: customer_activities id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_activities ALTER COLUMN id SET DEFAULT nextval('public.customer_activities_id_seq'::regclass);


--
-- Name: customer_contacts id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_contacts ALTER COLUMN id SET DEFAULT nextval('public.customer_contacts_id_seq'::regclass);


--
-- Name: customer_product_pricing id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_product_pricing ALTER COLUMN id SET DEFAULT nextval('public.customer_product_pricing_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: ekgx_leads id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.ekgx_leads ALTER COLUMN id SET DEFAULT nextval('public.ekgx_leads_id_seq'::regclass);


--
-- Name: invoice_activities id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoice_activities ALTER COLUMN id SET DEFAULT nextval('public.invoice_activities_id_seq'::regclass);


--
-- Name: invoice_payments id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoice_payments ALTER COLUMN id SET DEFAULT nextval('public.invoice_payments_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: order_activities id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.order_activities ALTER COLUMN id SET DEFAULT nextval('public.order_activities_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: poster_posts id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.poster_posts ALTER COLUMN id SET DEFAULT nextval('public.poster_posts_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: promotion_products id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.promotion_products ALTER COLUMN id SET DEFAULT nextval('public.promotion_products_id_seq'::regclass);


--
-- Name: promotions id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);


--
-- Name: sales_opportunities id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.sales_opportunities ALTER COLUMN id SET DEFAULT nextval('public.sales_opportunities_id_seq'::regclass);


--
-- Name: sales_reps id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.sales_reps ALTER COLUMN id SET DEFAULT nextval('public.sales_reps_id_seq'::regclass);


--
-- Name: shipping_policies id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.shipping_policies ALTER COLUMN id SET DEFAULT nextval('public.shipping_policies_id_seq'::regclass);


--
-- Name: supply_activity_events id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_activity_events ALTER COLUMN id SET DEFAULT nextval('public.supply_activity_events_id_seq'::regclass);


--
-- Name: supply_documents id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_documents ALTER COLUMN id SET DEFAULT nextval('public.supply_documents_id_seq'::regclass);


--
-- Name: supply_inventory_costing id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_inventory_costing ALTER COLUMN id SET DEFAULT nextval('public.supply_inventory_costing_id_seq'::regclass);


--
-- Name: supply_inventory_movements id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.supply_inventory_movements_id_seq'::regclass);


--
-- Name: supply_procurement_shipments id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_procurement_shipments ALTER COLUMN id SET DEFAULT nextval('public.supply_procurement_shipments_id_seq'::regclass);


--
-- Name: supply_purchase_order_lines id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_purchase_order_lines ALTER COLUMN id SET DEFAULT nextval('public.supply_purchase_order_lines_id_seq'::regclass);


--
-- Name: supply_purchase_orders id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.supply_purchase_orders_id_seq'::regclass);


--
-- Name: supply_receipt_lines id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_receipt_lines ALTER COLUMN id SET DEFAULT nextval('public.supply_receipt_lines_id_seq'::regclass);


--
-- Name: supply_receipts id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_receipts ALTER COLUMN id SET DEFAULT nextval('public.supply_receipts_id_seq'::regclass);


--
-- Name: supply_shipment_lines id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_shipment_lines ALTER COLUMN id SET DEFAULT nextval('public.supply_shipment_lines_id_seq'::regclass);


--
-- Name: supply_shipments id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_shipments ALTER COLUMN id SET DEFAULT nextval('public.supply_shipments_id_seq'::regclass);


--
-- Name: supply_vendor_bills id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_vendor_bills ALTER COLUMN id SET DEFAULT nextval('public.supply_vendor_bills_id_seq'::regclass);


--
-- Name: supply_vendors id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_vendors ALTER COLUMN id SET DEFAULT nextval('public.supply_vendors_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: workspace_action_points id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.workspace_action_points ALTER COLUMN id SET DEFAULT nextval('public.workspace_action_points_id_seq'::regclass);


--
-- Name: workspace_documents id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.workspace_documents ALTER COLUMN id SET DEFAULT nextval('public.workspace_documents_id_seq'::regclass);


--
-- Name: workspace_folders id; Type: DEFAULT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.workspace_folders ALTER COLUMN id SET DEFAULT nextval('public.workspace_folders_id_seq'::regclass);


--
-- Data for Name: auth_sessions; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.auth_sessions (id, user_id, token_hash, expires_at, created_at) FROM stdin;
2	1	bc705cf5dbfe209671393520cb36a32ca77ef80f799284666e4371f6c7ad2c27	2026-06-24 20:21:04.437	2026-06-10 20:21:04.437228
3	2	e65b634453bb5ba9f892aea405c214ebcd7a8a401d567c1d9c5df951886badaf	2026-06-24 20:25:56.727	2026-06-10 20:25:56.728442
4	1	bee18c8350bc88ab042e2ab704d7277be65b85d344484adf345bd2f9594cb424	2026-06-24 20:27:47.978	2026-06-10 20:27:47.978507
6	5	4825cf71b74931e30f340943f2455ce957c1e678abc5177dbc9659e0afa38d50	2026-06-30 16:05:36.455	2026-06-16 16:05:36.456147
12	1	7b8d6294bcdb40276d44dda9bfa2b95060ab35788eea1871b83cb4ff35773af6	2026-06-30 17:14:55.729	2026-06-16 17:14:55.73057
13	6	7b5edabe548b642a054cb7b2a77298562283204873743bbcb2a8d57df48f90cc	2026-06-30 18:52:31.006	2026-06-16 18:52:31.007079
\.


--
-- Data for Name: collaborative_tasks; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.collaborative_tasks (id, title, notes, priority, category, completed, created_by_user_id, completed_by_user_id, completed_at, created_at, updated_at) FROM stdin;
1	Follow up with Ashish and James for LATAM paperwork	\N	high	Follow-up	f	5	\N	\N	2026-06-16 16:09:24.852377	2026-06-16 16:09:24.852377
2	Get updated EKGx brochures	\N	high	Follow-up	f	5	\N	\N	2026-06-16 16:27:36.536687	2026-06-16 16:27:36.536687
3	Integrate FB Leads into CRM	\N	high	Follow-up	f	1	\N	\N	2026-06-16 17:34:53.80518	2026-06-16 17:34:53.80518
4	Confirm 8145 Qt and place order	\N	high	Follow-up	f	5	\N	\N	2026-06-16 21:31:40.195477	2026-06-16 21:31:40.195477
\.


--
-- Data for Name: customer_account_actions; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.customer_account_actions (id, customer_id, action_type, title, details, previous_value, next_value, created_by, created_at) FROM stdin;
1	1	customer_created	Customer Centers Urgent Care imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.709169
2	2	customer_created	Customer Duly Health & Care imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.712274
3	3	customer_created	Customer Total Compliance Network imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.715158
4	4	customer_created	Customer Island Hospital imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.719722
5	5	customer_created	Customer D&H Medical Supply imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.723463
6	6	customer_created	Customer Boe Group LLC imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.724671
7	7	customer_created	Customer Federated Healthcare Supply imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.724817
8	8	customer_created	Customer HSS Medical Supply imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.726389
9	9	customer_created	Customer G Medical dba Pharmaceutics imported	\N	\N	\N	Morris Setton	2026-06-10 20:20:10.726581
10	10	customer_created	Customer Philip Freed created	\N	\N	\N	Morris Setton	2026-06-15 21:09:02.199041
11	11	customer_created	Customer Marcus Hill created	\N	\N	\N	Morris Setton	2026-06-15 21:15:20.127253
12	12	customer_created	Customer Mohan John created	\N	\N	\N	Morris Setton	2026-06-16 16:07:52.150664
13	13	customer_created	Customer Pocket Nurse created	\N	\N	\N	Morris Setton	2026-06-16 16:34:42.249488
14	14	customer_created	Customer New York Cardiovascular created	\N	\N	\N	Morris Setton	2026-06-16 16:36:47.172341
15	15	customer_created	Customer East Side Primary Medical Care created	\N	\N	\N	Morris Setton	2026-06-16 18:08:46.646507
16	16	customer_created	Customer Jonathan Twan created	\N	\N	\N	Morris Setton	2026-06-16 18:26:57.150494
17	17	customer_created	Customer Nyasha Cecil Nyamupaguma created	\N	\N	\N	Morris Setton	2026-06-16 19:33:15.953667
18	18	customer_created	Customer Lori Dowie created	\N	\N	\N	Morris Setton	2026-06-16 21:31:02.8709
\.


--
-- Data for Name: customer_activities; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.customer_activities (id, customer_id, activity_type, subject, details, outcome, due_date, is_completed, created_by, created_at) FROM stdin;
1	2	email	Email for Duly Health & Care	Currently Testing	\N	\N	f	Izzy Miller	2026-06-16 16:07:51.452925
2	12	email	Email for Sedeer Medical	Sent Email with brochures and attached James who will send technical details	\N	\N	f	Morris Setton	2026-06-16 16:10:59.710962
3	6	call	Call for Boe Group LLC	His pricing is too low for the triplex however there is an opportunity for EKGx	\N	\N	f	Izzy Miller	2026-06-16 16:11:26.606462
4	1	email	Email for Centers Urgent Care	Sent product list need to send pricing	\N	\N	f	Morris Setton	2026-06-16 16:13:23.132981
5	5	email	Email for D&H Medical Supply	\N	\N	\N	f	Izzy Miller	2026-06-16 16:20:51.235809
6	7	email	Email for Federated Healthcare Supply	Follow up on the planned parenthood opportunity.\nTry to get more product listed.	\N	\N	f	Izzy Miller	2026-06-16 16:24:58.247262
7	9	email	Email for G Medical dba Pharmaceutics	Send Promo	\N	\N	f	Izzy Miller	2026-06-16 16:25:50.967698
8	13	email	Email for Pocket Nurse	Signed Contracts. Waiting on delivery for first location and for new locations to open.	\N	\N	f	Izzy Miller	2026-06-16 16:37:57.300741
9	13	meeting	Schedule a Meeting for Pocket Nurse	meeting set for 6/25	\N	\N	f	Izzy Miller	2026-06-16 16:38:18.375048
10	14	email	Email for New York Cardiovascular	Signed Contracts. Waiting on delivery for first location and for new locations to open.	\N	\N	f	Izzy Miller	2026-06-16 16:38:27.432502
11	15	email	Email for East Side Primary Medical Care	asked for more info sent him email. lets schedule demo	\N	\N	f	Morris Setton	2026-06-16 18:18:28.410099
12	16	email	Email for Alltheda Healthcare	Asked for more info. Sent, trying to schedule a demo.	\N	\N	f	Morris Setton	2026-06-16 18:27:24.869543
13	17	email	Email for N/A	Sent email to schedule call for Monday 6/22	\N	\N	f	Izzy Miller	2026-06-16 20:26:16.856459
14	15	email	Email for East Side Primary Medical Care	Sent email asking for Demo time	\N	\N	f	Izzy Miller	2026-06-16 21:13:03.205289
15	18	meeting	Schedule a Meeting for 4mydo	Meeting Scheduled	\N	\N	f	Izzy Miller	2026-06-16 21:31:54.285064
\.


--
-- Data for Name: customer_contacts; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.customer_contacts (id, customer_id, name, title, email, phone, is_primary, created_at) FROM stdin;
1	1	Yehuda Schonfeld	Assistant Medical Director	yschonfeld@centersurgentcare.net	718-490-1887	t	2026-06-10 20:20:10.698913
2	2	Catherine Robinson	Laboratory Manager	catherine.robinson@duly.com	815-474-2984	t	2026-06-10 20:20:10.698913
3	3	Ryan Silver	\N	rsilver@totalcompnet.net	\N	t	2026-06-10 20:20:10.698913
4	4	David Peterson	Buyer	david.peterson@islandhospital.org	360-299-4969	t	2026-06-10 20:20:10.698913
5	5	Robert Sampson	Vice-President/National Sales Director	rsampson@dhmedsupply.com	740-381-8256	t	2026-06-10 20:20:10.698913
6	6	Joel M. Boé	\N	jboe@boegroupllc.com	225-572-6181	t	2026-06-10 20:20:10.698913
7	7	Jennifer Drummond	Purchasing/Inventory Manager	jdrummond@fedhs.com	484-845-3207	t	2026-06-10 20:20:10.698913
8	8	John Corrigan	Director of Purchasing	john.corrigan@hssmedicalsupply.com	\N	t	2026-06-10 20:20:10.698913
9	9	Andrew Gosman	\N	andrewgosman@hotmail.com	617-593-7779	t	2026-06-10 20:20:10.698913
\.


--
-- Data for Name: customer_flags; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.customer_flags (customer_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: customer_product_pricing; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.customer_product_pricing (id, customer_id, product_id, custom_unit_price, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.customers (id, name, company_name, primary_contact_name, email, phone, address, billing_address, shipping_address, status, rep_id, credit_limit, custom_pricing, custom_terms, customer_since_date, created_at) FROM stdin;
1	Centers Urgent Care	Centers Urgent Care	Yehuda Schonfeld	yschonfeld@centersurgentcare.net	718-490-1887	\N	\N	\N	active	1	10000.00	f	net 30	\N	2026-06-10 20:20:10.697439
2	Duly Health & Care	Duly Health & Care	Catherine Robinson	catherine.robinson@duly.com	815-474-2984	\N	\N	\N	prospect	4	10000.00	f	net 30	\N	2026-06-10 20:20:10.697439
3	Total Compliance Network	Total Compliance Network	Ryan Silver	rsilver@totalcompnet.net	\N	\N	\N	\N	active	4	10000.00	f	\N	\N	2026-06-10 20:20:10.697439
4	Island Hospital	Island Hospital	David Peterson	david.peterson@islandhospital.org	360-299-4969	\N	\N	\N	active	4	10000.00	f	\N	\N	2026-06-10 20:20:10.697439
5	D&H Medical Supply	D&H Medical Supply	Robert Sampson	rsampson@dhmedsupply.com	740-381-8256	\N	\N	\N	active	4	10000.00	f	\N	\N	2026-06-10 20:20:10.697439
6	Boe Group LLC	Boe Group LLC	Joel M. Boé	jboe@boegroupllc.com	225-572-6181	\N	\N	\N	active	4	10000.00	f	\N	\N	2026-06-10 20:20:10.697439
7	Federated Healthcare Supply	Federated Healthcare Supply	Jennifer Drummond	jdrummond@fedhs.com	484-845-3207	\N	\N	\N	active	4	10000.00	f	\N	\N	2026-06-10 20:20:10.697439
8	HSS Medical Supply	HSS Medical Supply	John Corrigan	john.corrigan@hssmedicalsupply.com	\N	\N	\N	\N	active	4	10000.00	f	\N	\N	2026-06-10 20:20:10.697439
9	G Medical dba Pharmaceutics	G Medical dba Pharmaceutics	Andrew Gosman	andrewgosman@hotmail.com	617-593-7779	\N	\N	\N	active	4	10000.00	f	\N	\N	2026-06-10 20:20:10.697439
10	Philip Freed	CMEDDS	Philip Freed	Pfreed@cmedds.com	18009759819	\N	\N	\N	prospect	\N	10000.00	f	Net 30	\N	2026-06-15 21:09:02.195907
12	Mohan John	Sedeer Medical	Mohan John	j.mohan@sedeer.com	\N	\N	\N	\N	prospect	\N	10000.00	f	Net 30	\N	2026-06-16 16:07:52.149486
13	Pocket Nurse	Pocket Nurse	Chris Shirer	cshirer@pocketnurse.com	724-480-3698	\N	\N	\N	prospect	\N	10000.00	f	Net 30	\N	2026-06-16 16:34:42.248307
14	New York Cardiovascular	New York Cardiovascular	Sara Hamadani	Nycardio2@gmail.com	\N	\N	\N	\N	active	4	10000.00	f	Net 30	\N	2026-06-16 16:36:47.171159
15	East Side Primary Medical Care	East Side Primary Medical Care	Dr. Daniel P. Klein	drdpklein@espmc.net	2127372000	\N	\N	\N	prospect	\N	10000.00	f	Net 30	\N	2026-06-16 18:08:46.645
16	Jonathan Twan	Alltheda Healthcare	Jonathan Twan	Jonathantwan@altheda.com	4127213760	\N	\N	\N	prospect	\N	10000.00	f	Net 30	\N	2026-06-16 18:26:57.149386
17	Nyasha Cecil Nyamupaguma	N/A	Nyasha Cecil Nyamupaguma	nyashacecil@gmail.com	\N	\N	\N	\N	prospect	\N	10000.00	f	Net 30	\N	2026-06-16 19:33:15.952393
11	Justin Mavromatis	Norwood Urgent Care	Justin Mavromatis	jmavromatis@norwoodurgentcare.com	740-381-8256	\N	\N	\N	prospect	\N	10000.00	f	Net 30	\N	2026-06-15 21:15:20.125989
18	Lori Dowie	4mydo	Lori Dowie	Loridowie.chriscebollero@gmail.com	5612368201	\N	\N	\N	prospect	\N	10000.00	f	Net 30	\N	2026-06-16 21:31:02.868986
\.


--
-- Data for Name: ekgx_leads; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.ekgx_leads (id, business_name, contact_name, email, phone, submitted_at, status, source, notes, last_contact_at, last_contact_summary, flagged, created_at, updated_at) FROM stdin;
1	Elevate Athletics	Chris Dalton	\N	(770) 555-0188	2026-06-08 12:20:00	contacted	Facebook	Looking for a fast rollout timeline before summer training programs begin.	2026-06-08 16:30:00	Left a voicemail and sent a follow-up text.	f	2026-06-10 19:59:52.099496	2026-06-10 19:59:52.099496
2	Core Motion Performance	Avery Brooks	avery@coremotion.io	(470) 555-0121	2026-06-07 17:45:00	not_contacted	Facebook	Mentioned comparing multiple vendors and wants a simple next-step plan.	\N	\N	t	2026-06-10 19:59:52.099496	2026-06-10 19:59:52.099496
4	Harbor Fitness Studio	Janelle Price	janelle@harborfit.co	(404) 555-0192	2026-06-09 09:15:00	not_contacted	Facebook	Interested in onboarding options for a growing studio footprint.	\N	\N	f	2026-06-10 19:59:52.099496	2026-06-10 19:59:52.099496
3	Northside Wellness	Marcus Hill	marcus@northsidewellness.com	(678) 555-0114	2026-06-09 10:40:00	contacted	Facebook		\N	\N	f	2026-06-10 19:59:52.099496	2026-06-16 21:24:03.74
5	Peak Recovery Lab	Sofia Bennett	sofia@peakrecoverylab.com	\N	2026-06-08 15:05:00	contacted	Facebook		2026-06-16 21:37:16.603	Said to call back	f	2026-06-10 19:59:52.099496	2026-06-16 21:37:16.662
\.


--
-- Data for Name: invoice_activities; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.invoice_activities (id, invoice_id, activity_type, title, details, previous_value, next_value, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: invoice_payments; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.invoice_payments (id, invoice_id, amount, payment_date, payment_method, reference_number, notes, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.invoices (id, invoice_number, customer_id, order_id, amount, amount_paid, due_date, invoice_date, is_paid, payment_status, collections_status, last_payment_date, promised_payment_date, promise_note, dispute_reason, write_off_reason, external_ref, sync_status, sync_error, last_synced_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: order_activities; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.order_activities (id, order_id, activity_type, title, details, previous_value, next_value, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.order_items (id, order_id, product_id, quantity, unit_price, discount_amount, line_total, promotion_name, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.orders (id, order_number, customer_id, rep_id, status, subtotal, discount_total, shipping_cost, total, shipping_policy_id, shipping_carrier, shipping_method, tracking_number, custom_terms, fulfillment_status, fulfillment_progress, invoice_status, risk_level, last_action_at, order_date, created_at) FROM stdin;
\.


--
-- Data for Name: poster_post_targets; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.poster_post_targets (post_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: poster_posts; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.poster_posts (id, post_type, title, body, include_all_users, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.products (id, sku, name, category, description, unit_price, inventory_qty, average_cost, last_purchase_cost, eta_date, image_url, pack_size, certifications, brochure_url, info_sheet_url, archived, archive_reason, created_at) FROM stdin;
\.


--
-- Data for Name: promotion_products; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.promotion_products (id, promotion_id, product_id) FROM stdin;
\.


--
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.promotions (id, name, discount_type, discount_value, start_date, end_date, created_at) FROM stdin;
\.


--
-- Data for Name: sales_opportunities; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.sales_opportunities (id, customer_id, title, status, source, lifecycle, due_date, notes, last_contacted_at, last_contact_note, created_at, updated_at) FROM stdin;
1	2	Platinum Machines.	Email	existing_customer	open	\N	\N	2026-06-16 16:07:51.452	contact-log:{"actionType":"email","actionLabel":"Email","salesRepId":4,"salesRepName":"Izzy Miller","details":"Currently Testing","createdAt":"2026-06-16T16:07:51.452Z","activityId":1,"subject":"Email for Duly Health & Care"}	2026-06-16 16:06:36.652136	2026-06-16 16:07:51.483
2	12	Qatar Platinum UA	Email	existing_customer	open	\N	\N	2026-06-16 16:10:59.71	contact-log:{"actionType":"email","actionLabel":"Email","salesRepId":1,"salesRepName":"Morris Setton","details":"Sent Email with brochures and attached James who will send technical details","createdAt":"2026-06-16T16:10:59.710Z","activityId":2,"subject":"Email for Sedeer Medical"}	2026-06-16 16:09:23.75561	2026-06-16 16:10:59.732
3	6	Help us get EKGx into urgent cares	Call	existing_customer	open	\N	\N	2026-06-16 16:11:26.606	contact-log:{"actionType":"call","actionLabel":"Call","salesRepId":4,"salesRepName":"Izzy Miller","details":"His pricing is too low for the triplex however there is an opportunity for EKGx","createdAt":"2026-06-16T16:11:26.606Z","activityId":3,"subject":"Call for Boe Group LLC"}	2026-06-16 16:10:36.679974	2026-06-16 16:11:26.627
4	1	Infectious disease and EKGx expansion	Email	existing_customer	open	\N	\N	2026-06-16 16:13:23.132	contact-log:{"actionType":"email","actionLabel":"Email","salesRepId":1,"salesRepName":"Morris Setton","details":"Sent product list need to send pricing","createdAt":"2026-06-16T16:13:23.132Z","activityId":4,"subject":"Email for Centers Urgent Care"}	2026-06-16 16:12:49.232219	2026-06-16 16:13:23.153
5	5	IMCO Member Bought Drug cups follow up for more	Email	existing_customer	open	\N	\N	2026-06-16 16:20:51.235	contact-log:{"actionType":"email","actionLabel":"Email","salesRepId":4,"salesRepName":"Izzy Miller","details":null,"createdAt":"2026-06-16T16:20:51.235Z","activityId":5,"subject":"Email for D&H Medical Supply"}	2026-06-16 16:20:37.120989	2026-06-16 16:20:51.255
6	7	HCG	Email	existing_customer	open	\N	\N	2026-06-16 16:24:58.247	contact-log:{"actionType":"email","actionLabel":"Email","salesRepId":4,"salesRepName":"Izzy Miller","details":"Follow up on the planned parenthood opportunity.\\nTry to get more product listed.","createdAt":"2026-06-16T16:24:58.247Z","activityId":6,"subject":"Email for Federated Healthcare Supply"}	2026-06-16 16:22:19.051448	2026-06-16 16:24:58.272
7	9	Infectious Disease	Email	existing_customer	open	\N	\N	2026-06-16 16:25:50.967	contact-log:{"actionType":"email","actionLabel":"Email","salesRepId":4,"salesRepName":"Izzy Miller","details":"Send Promo","createdAt":"2026-06-16T16:25:50.967Z","activityId":7,"subject":"Email for G Medical dba Pharmaceutics"}	2026-06-16 16:23:49.982599	2026-06-16 16:25:50.994
8	13	Meeting on 6/25 to discuss opportunities	Schedule a Meeting	existing_customer	open	\N	\N	2026-06-16 16:38:18.375	contact-log:{"actionType":"meeting","actionLabel":"Schedule a Meeting","salesRepId":4,"salesRepName":"Izzy Miller","details":"meeting set for 6/25","createdAt":"2026-06-16T16:38:18.375Z","activityId":9,"subject":"Schedule a Meeting for Pocket Nurse"}	2026-06-16 16:35:34.041679	2026-06-16 16:38:18.399
9	14	Expand to more locations	Email	existing_customer	open	\N	\N	2026-06-16 16:38:27.432	contact-log:{"actionType":"email","actionLabel":"Email","salesRepId":4,"salesRepName":"Izzy Miller","details":"Signed Contracts. Waiting on delivery for first location and for new locations to open.","createdAt":"2026-06-16T16:38:27.432Z","activityId":10,"subject":"Email for New York Cardiovascular"}	2026-06-16 16:37:12.230996	2026-06-16 16:38:27.451
10	15	Confirm in person Meeting	Email	existing_customer	open	\N	\N	2026-06-16 21:13:03.205	contact-log:{"actionType":"email","actionLabel":"Email","salesRepId":4,"salesRepName":"Izzy Miller","details":"Sent email asking for Demo time","createdAt":"2026-06-16T21:13:03.205Z","activityId":14,"subject":"Email for East Side Primary Medical Care"}	2026-06-16 21:12:35.894132	2026-06-16 21:13:03.229
11	18	Demo Set for Wed 6/17 in Florida	Schedule a Meeting	existing_customer	open	\N	\N	2026-06-16 21:31:54.285	contact-log:{"actionType":"meeting","actionLabel":"Schedule a Meeting","salesRepId":4,"salesRepName":"Izzy Miller","details":"Meeting Scheduled","createdAt":"2026-06-16T21:31:54.285Z","activityId":15,"subject":"Schedule a Meeting for 4mydo"}	2026-06-16 21:31:40.97073	2026-06-16 21:31:54.411
\.


--
-- Data for Name: sales_reps; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.sales_reps (id, name, email, created_at) FROM stdin;
2	Sofia Patel	sofia.patel@clarity.local	2026-06-10 19:59:51.78416
3	Marcus Johnson	marcus.johnson@clarity.local	2026-06-10 19:59:51.78416
1	Morris Setton	morris@claritydiagnostics.com	2026-06-10 19:59:51.78416
4	Izzy Miller	isadore.miller@claritydiagnostics.com	2026-06-10 19:59:51.78416
5	Philip Kahn	pkahn@geneva.pe	2026-06-16 17:40:59.362887
\.


--
-- Data for Name: shipping_policies; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.shipping_policies (id, name, description, carrier, shipping_method, shipping_cost, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: supply_activity_events; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_activity_events (id, entity_type, entity_id, event_type, summary, actor_name, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: supply_documents; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_documents (id, entity_type, entity_id, document_type, file_name, mime_type, size_bytes, checksum, content_base64, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: supply_inventory_costing; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_inventory_costing (id, sku, product_name, current_inventory, current_average_cost, last_purchase_cost, incoming_landed_cost, selling_price, created_at) FROM stdin;
\.


--
-- Data for Name: supply_inventory_movements; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_at) FROM stdin;
\.


--
-- Data for Name: supply_procurement_shipments; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_procurement_shipments (id, shipment_number, purchase_order_id, status, origin, destination, departure_date, eta, carrier, tracking_number, container_number, freight_cost, customs_and_duties, brokerage_fees, drayage, warehouse_receiving_costs, miscellaneous_costs, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: supply_purchase_order_lines; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_purchase_order_lines (id, purchase_order_id, product_id, ordered_quantity, unit_cost, received_quantity, damaged_quantity, rejected_quantity) FROM stdin;
\.


--
-- Data for Name: supply_purchase_orders; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_purchase_orders (id, po_number, vendor_id, status, order_date, expected_date, destination, payment_terms, notes, issued_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: supply_receipt_lines; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_receipt_lines (id, receipt_id, shipment_line_id, accepted_quantity, damaged_quantity, rejected_quantity, landed_unit_cost, inventory_qty_before, average_cost_before, last_purchase_cost_before) FROM stdin;
\.


--
-- Data for Name: supply_receipts; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_receipts (id, receipt_number, shipment_id, status, received_at, received_by, discrepancy_notes, confirmed_at, reversed_at, created_at) FROM stdin;
\.


--
-- Data for Name: supply_shipment_lines; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_shipment_lines (id, shipment_id, purchase_order_line_id, quantity, allocated_landed_cost, allocation_override) FROM stdin;
\.


--
-- Data for Name: supply_shipments; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_shipments (id, shipment_id, vendor_id, origin, destination, departure_date, eta, status, tracking_number, purchase_order_number, container_number, sku_count, quantity, product_cost, freight_cost, customs_and_duties, brokerage_fees, drayage, warehouse_receiving_costs, miscellaneous_costs, notes, documents, timeline, created_at) FROM stdin;
\.


--
-- Data for Name: supply_vendor_bills; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_vendor_bills (id, bill_number, purchase_order_id, vendor_invoice_number, invoice_date, amount, status, matched_at, created_at) FROM stdin;
\.


--
-- Data for Name: supply_vendors; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.supply_vendors (id, name, vendor_code, primary_contact_name, email, phone, lead_time_days, on_time_delivery_pct, shipment_count, total_spend, quality_rating, created_at) FROM stdin;
\.


--
-- Data for Name: task_assignments; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.task_assignments (task_id, user_id, assignment_source, created_at) FROM stdin;
1	5	creator	2026-06-16 16:09:24.852377
2	5	creator	2026-06-16 16:27:36.536687
3	1	creator	2026-06-16 17:34:53.80518
4	5	creator	2026-06-16 21:31:40.195477
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.users (id, sales_rep_id, name, email, phone, login_pin, title, role, status, last_active_at, last_login_at, created_at, updated_at, password_hash, password_reset_required) FROM stdin;
4	3	Marcus Johnson	marcus.johnson@clarity.local	(347) 555-0191	2468	Sales Representative	sales_rep	inactive	2026-06-10 16:59:51.785273	\N	2026-06-10 19:59:51.785273	2026-06-16 16:54:29.377	legacy:2468	t
3	2	Sofia Patel	sofia.patel@clarity.local	(718) 555-0164	2468	Sales Representative	sales_rep	inactive	2026-06-10 17:59:51.785273	\N	2026-06-10 19:59:51.785273	2026-06-16 16:54:32.927	legacy:2468	t
2	1	Morris Setton	morris@claritydiagnostics.com	3477075340	2468	Sales Representative	sales_rep	active	2026-06-16 16:55:39.034	2026-06-16 16:55:39.034	2026-06-10 19:59:51.785273	2026-06-16 17:14:39.149	scrypt:b371501524e1c2fc202e3bdc14eaa787:06a484d2701259cd477d5e67364f3844b9f3724a7645d96d2b507be065f8ac0851d36198ab219fca50f865f949330ae84b702bb966efac51d7d72f1963dcaad5	f
1	\N	Morris Setton	morris.setton@clarity.local	(212) 555-0100	2468	Main Administrator	admin	active	2026-06-16 17:14:55.729	2026-06-16 17:14:55.729	2026-06-10 19:59:51.782345	2026-06-16 17:15:18.656	scrypt:6afd01140471b2c70e49c206f6fdbf9c:f38774838a40a9ff233a554d3e6a367c8889fa3a6b431357c0c88c427e60021e9ada6c37453403c73352f6aaea2178d412970d413f8ad3241cf87298e6596216	f
6	5	Philip Kahn	pkahn@geneva.pe	443-280-7069	2468	Sales Representative	sales_rep	active	2026-06-16 18:52:31.006	2026-06-16 18:52:31.006	2026-06-16 17:40:59.362887	2026-06-16 18:53:16.778	scrypt:54486b465221b0197fd5861e48afa504:819f7ffdb0cc2d815ad23bc8c3887a27d6f1a6be09a52ab2adb76da26d0ac303e572206820b83fe5e357971cb617ef5e3e02812e1624017d0459c0310208d16a	f
5	4	Izzy Miller	isadore.miller@claritydiagnostics.com	(917) 555-0138	2468	Sales Representative	sales_rep	active	2026-06-16 16:05:36.457	2026-06-16 16:05:36.457	2026-06-10 19:59:51.785273	2026-06-16 19:44:50.438	scrypt:090df7c89d634f37d4d13693f265467e:f84fa65ad0ca7dc48c939efc5d0ff0b44809580f193e9fc98258b5d2bef69adca3401f18bbccb3ad6ee47d90ead791e9f166efb342f0f6c4884889f7e14d7b81	f
\.


--
-- Data for Name: workspace_action_points; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.workspace_action_points (id, user_id, customer_id, title, details, due_date, completed, created_at, updated_at) FROM stdin;
1	5	1	Price list	Send price list for infectious disease	2026-06-17	f	2026-06-16 16:14:55.707877	2026-06-16 16:14:55.707877
3	2	6	Test	Test	2026-06-16	t	2026-06-16 16:49:18.181459	2026-06-16 16:53:45.958
2	5	9	Send promo to Andrew		2026-06-16	f	2026-06-16 16:27:11.190197	2026-06-16 16:54:04.877
4	1	12	Get agreement and send documentation		2026-06-16	f	2026-06-16 17:30:22.567665	2026-06-16 17:30:22.567665
\.


--
-- Data for Name: workspace_documents; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.workspace_documents (id, folder_id, title, category, description, file_name, mime_type, size_bytes, checksum, content_base64, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: workspace_folders; Type: TABLE DATA; Schema: public; Owner: morris
--

COPY public.workspace_folders (id, name, parent_id, created_by, created_at) FROM stdin;
\.


--
-- Name: auth_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.auth_sessions_id_seq', 13, true);


--
-- Name: collaborative_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.collaborative_tasks_id_seq', 4, true);


--
-- Name: customer_account_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.customer_account_actions_id_seq', 18, true);


--
-- Name: customer_activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.customer_activities_id_seq', 15, true);


--
-- Name: customer_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.customer_contacts_id_seq', 9, true);


--
-- Name: customer_product_pricing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.customer_product_pricing_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.customers_id_seq', 18, true);


--
-- Name: ekgx_leads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.ekgx_leads_id_seq', 5, true);


--
-- Name: invoice_activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.invoice_activities_id_seq', 1, false);


--
-- Name: invoice_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.invoice_payments_id_seq', 1, false);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.invoices_id_seq', 1, false);


--
-- Name: order_activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.order_activities_id_seq', 1, false);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.order_items_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: poster_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.poster_posts_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.products_id_seq', 1, false);


--
-- Name: promotion_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.promotion_products_id_seq', 1, false);


--
-- Name: promotions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.promotions_id_seq', 1, false);


--
-- Name: sales_opportunities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.sales_opportunities_id_seq', 11, true);


--
-- Name: sales_reps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.sales_reps_id_seq', 5, true);


--
-- Name: shipping_policies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.shipping_policies_id_seq', 1, false);


--
-- Name: supply_activity_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_activity_events_id_seq', 1, false);


--
-- Name: supply_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_documents_id_seq', 1, false);


--
-- Name: supply_inventory_costing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_inventory_costing_id_seq', 1, false);


--
-- Name: supply_inventory_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_inventory_movements_id_seq', 1, false);


--
-- Name: supply_procurement_shipments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_procurement_shipments_id_seq', 1, false);


--
-- Name: supply_purchase_order_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_purchase_order_lines_id_seq', 1, false);


--
-- Name: supply_purchase_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_purchase_orders_id_seq', 1, false);


--
-- Name: supply_receipt_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_receipt_lines_id_seq', 1, false);


--
-- Name: supply_receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_receipts_id_seq', 1, false);


--
-- Name: supply_shipment_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_shipment_lines_id_seq', 1, false);


--
-- Name: supply_shipments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_shipments_id_seq', 1, false);


--
-- Name: supply_vendor_bills_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_vendor_bills_id_seq', 1, false);


--
-- Name: supply_vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.supply_vendors_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- Name: workspace_action_points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.workspace_action_points_id_seq', 4, true);


--
-- Name: workspace_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.workspace_documents_id_seq', 1, false);


--
-- Name: workspace_folders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: morris
--

SELECT pg_catalog.setval('public.workspace_folders_id_seq', 1, false);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: collaborative_tasks collaborative_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.collaborative_tasks
    ADD CONSTRAINT collaborative_tasks_pkey PRIMARY KEY (id);


--
-- Name: customer_account_actions customer_account_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_account_actions
    ADD CONSTRAINT customer_account_actions_pkey PRIMARY KEY (id);


--
-- Name: customer_activities customer_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_activities
    ADD CONSTRAINT customer_activities_pkey PRIMARY KEY (id);


--
-- Name: customer_contacts customer_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_pkey PRIMARY KEY (id);


--
-- Name: customer_flags customer_flags_customer_id_user_id_pk; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_flags
    ADD CONSTRAINT customer_flags_customer_id_user_id_pk PRIMARY KEY (customer_id, user_id);


--
-- Name: customer_product_pricing customer_product_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_product_pricing
    ADD CONSTRAINT customer_product_pricing_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: ekgx_leads ekgx_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.ekgx_leads
    ADD CONSTRAINT ekgx_leads_pkey PRIMARY KEY (id);


--
-- Name: invoice_activities invoice_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoice_activities
    ADD CONSTRAINT invoice_activities_pkey PRIMARY KEY (id);


--
-- Name: invoice_payments invoice_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: order_activities order_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.order_activities
    ADD CONSTRAINT order_activities_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: poster_post_targets poster_post_targets_post_id_user_id_pk; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.poster_post_targets
    ADD CONSTRAINT poster_post_targets_post_id_user_id_pk PRIMARY KEY (post_id, user_id);


--
-- Name: poster_posts poster_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.poster_posts
    ADD CONSTRAINT poster_posts_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_unique UNIQUE (sku);


--
-- Name: promotion_products promotion_products_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.promotion_products
    ADD CONSTRAINT promotion_products_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: sales_opportunities sales_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.sales_opportunities
    ADD CONSTRAINT sales_opportunities_pkey PRIMARY KEY (id);


--
-- Name: sales_reps sales_reps_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.sales_reps
    ADD CONSTRAINT sales_reps_pkey PRIMARY KEY (id);


--
-- Name: shipping_policies shipping_policies_name_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.shipping_policies
    ADD CONSTRAINT shipping_policies_name_unique UNIQUE (name);


--
-- Name: shipping_policies shipping_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.shipping_policies
    ADD CONSTRAINT shipping_policies_pkey PRIMARY KEY (id);


--
-- Name: supply_activity_events supply_activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_activity_events
    ADD CONSTRAINT supply_activity_events_pkey PRIMARY KEY (id);


--
-- Name: supply_documents supply_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_documents
    ADD CONSTRAINT supply_documents_pkey PRIMARY KEY (id);


--
-- Name: supply_inventory_costing supply_inventory_costing_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_inventory_costing
    ADD CONSTRAINT supply_inventory_costing_pkey PRIMARY KEY (id);


--
-- Name: supply_inventory_costing supply_inventory_costing_sku_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_inventory_costing
    ADD CONSTRAINT supply_inventory_costing_sku_unique UNIQUE (sku);


--
-- Name: supply_inventory_movements supply_inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_inventory_movements
    ADD CONSTRAINT supply_inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: supply_procurement_shipments supply_procurement_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_procurement_shipments
    ADD CONSTRAINT supply_procurement_shipments_pkey PRIMARY KEY (id);


--
-- Name: supply_procurement_shipments supply_procurement_shipments_shipment_number_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_procurement_shipments
    ADD CONSTRAINT supply_procurement_shipments_shipment_number_unique UNIQUE (shipment_number);


--
-- Name: supply_purchase_order_lines supply_purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_purchase_order_lines
    ADD CONSTRAINT supply_purchase_order_lines_pkey PRIMARY KEY (id);


--
-- Name: supply_purchase_orders supply_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_purchase_orders
    ADD CONSTRAINT supply_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: supply_purchase_orders supply_purchase_orders_po_number_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_purchase_orders
    ADD CONSTRAINT supply_purchase_orders_po_number_unique UNIQUE (po_number);


--
-- Name: supply_receipt_lines supply_receipt_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_receipt_lines
    ADD CONSTRAINT supply_receipt_lines_pkey PRIMARY KEY (id);


--
-- Name: supply_receipts supply_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_receipts
    ADD CONSTRAINT supply_receipts_pkey PRIMARY KEY (id);


--
-- Name: supply_receipts supply_receipts_receipt_number_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_receipts
    ADD CONSTRAINT supply_receipts_receipt_number_unique UNIQUE (receipt_number);


--
-- Name: supply_shipment_lines supply_shipment_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_shipment_lines
    ADD CONSTRAINT supply_shipment_lines_pkey PRIMARY KEY (id);


--
-- Name: supply_shipments supply_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_shipments
    ADD CONSTRAINT supply_shipments_pkey PRIMARY KEY (id);


--
-- Name: supply_shipments supply_shipments_shipment_id_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_shipments
    ADD CONSTRAINT supply_shipments_shipment_id_unique UNIQUE (shipment_id);


--
-- Name: supply_vendor_bills supply_vendor_bills_bill_number_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_vendor_bills
    ADD CONSTRAINT supply_vendor_bills_bill_number_unique UNIQUE (bill_number);


--
-- Name: supply_vendor_bills supply_vendor_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_vendor_bills
    ADD CONSTRAINT supply_vendor_bills_pkey PRIMARY KEY (id);


--
-- Name: supply_vendors supply_vendors_name_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_vendors
    ADD CONSTRAINT supply_vendors_name_unique UNIQUE (name);


--
-- Name: supply_vendors supply_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_vendors
    ADD CONSTRAINT supply_vendors_pkey PRIMARY KEY (id);


--
-- Name: supply_vendors supply_vendors_vendor_code_unique; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_vendors
    ADD CONSTRAINT supply_vendors_vendor_code_unique UNIQUE (vendor_code);


--
-- Name: task_assignments task_assignments_task_id_user_id_pk; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_task_id_user_id_pk PRIMARY KEY (task_id, user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workspace_action_points workspace_action_points_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.workspace_action_points
    ADD CONSTRAINT workspace_action_points_pkey PRIMARY KEY (id);


--
-- Name: workspace_documents workspace_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.workspace_documents
    ADD CONSTRAINT workspace_documents_pkey PRIMARY KEY (id);


--
-- Name: workspace_folders workspace_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.workspace_folders
    ADD CONSTRAINT workspace_folders_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions_token_hash_unique; Type: INDEX; Schema: public; Owner: morris
--

CREATE UNIQUE INDEX auth_sessions_token_hash_unique ON public.auth_sessions USING btree (token_hash);


--
-- Name: customer_product_pricing_customer_product_idx; Type: INDEX; Schema: public; Owner: morris
--

CREATE UNIQUE INDEX customer_product_pricing_customer_product_idx ON public.customer_product_pricing USING btree (customer_id, product_id);


--
-- Name: ekgx_leads_identity_unique; Type: INDEX; Schema: public; Owner: morris
--

CREATE UNIQUE INDEX ekgx_leads_identity_unique ON public.ekgx_leads USING btree (business_name, contact_name, submitted_at);


--
-- Name: supply_po_line_product_unique; Type: INDEX; Schema: public; Owner: morris
--

CREATE UNIQUE INDEX supply_po_line_product_unique ON public.supply_purchase_order_lines USING btree (purchase_order_id, product_id);


--
-- Name: users_email_unique; Type: INDEX; Schema: public; Owner: morris
--

CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email);


--
-- Name: users_sales_rep_id_unique; Type: INDEX; Schema: public; Owner: morris
--

CREATE UNIQUE INDEX users_sales_rep_id_unique ON public.users USING btree (sales_rep_id);


--
-- Name: auth_sessions auth_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: collaborative_tasks collaborative_tasks_completed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.collaborative_tasks
    ADD CONSTRAINT collaborative_tasks_completed_by_user_id_users_id_fk FOREIGN KEY (completed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collaborative_tasks collaborative_tasks_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.collaborative_tasks
    ADD CONSTRAINT collaborative_tasks_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: customer_account_actions customer_account_actions_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_account_actions
    ADD CONSTRAINT customer_account_actions_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_activities customer_activities_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_activities
    ADD CONSTRAINT customer_activities_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_contacts customer_contacts_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_flags customer_flags_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_flags
    ADD CONSTRAINT customer_flags_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_flags customer_flags_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_flags
    ADD CONSTRAINT customer_flags_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: customer_product_pricing customer_product_pricing_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_product_pricing
    ADD CONSTRAINT customer_product_pricing_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_product_pricing customer_product_pricing_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customer_product_pricing
    ADD CONSTRAINT customer_product_pricing_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: customers customers_rep_id_sales_reps_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_rep_id_sales_reps_id_fk FOREIGN KEY (rep_id) REFERENCES public.sales_reps(id);


--
-- Name: invoice_activities invoice_activities_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoice_activities
    ADD CONSTRAINT invoice_activities_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_payments invoice_payments_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_activities order_activities_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.order_activities
    ADD CONSTRAINT order_activities_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: orders orders_rep_id_sales_reps_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_rep_id_sales_reps_id_fk FOREIGN KEY (rep_id) REFERENCES public.sales_reps(id);


--
-- Name: orders orders_shipping_policy_id_shipping_policies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_shipping_policy_id_shipping_policies_id_fk FOREIGN KEY (shipping_policy_id) REFERENCES public.shipping_policies(id) ON DELETE SET NULL;


--
-- Name: poster_post_targets poster_post_targets_post_id_poster_posts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.poster_post_targets
    ADD CONSTRAINT poster_post_targets_post_id_poster_posts_id_fk FOREIGN KEY (post_id) REFERENCES public.poster_posts(id) ON DELETE CASCADE;


--
-- Name: poster_post_targets poster_post_targets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.poster_post_targets
    ADD CONSTRAINT poster_post_targets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: poster_posts poster_posts_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.poster_posts
    ADD CONSTRAINT poster_posts_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: promotion_products promotion_products_promotion_id_promotions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.promotion_products
    ADD CONSTRAINT promotion_products_promotion_id_promotions_id_fk FOREIGN KEY (promotion_id) REFERENCES public.promotions(id);


--
-- Name: sales_opportunities sales_opportunities_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.sales_opportunities
    ADD CONSTRAINT sales_opportunities_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: supply_inventory_movements supply_inventory_movements_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_inventory_movements
    ADD CONSTRAINT supply_inventory_movements_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: supply_procurement_shipments supply_procurement_shipments_purchase_order_id_supply_purchase_; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_procurement_shipments
    ADD CONSTRAINT supply_procurement_shipments_purchase_order_id_supply_purchase_ FOREIGN KEY (purchase_order_id) REFERENCES public.supply_purchase_orders(id);


--
-- Name: supply_purchase_order_lines supply_purchase_order_lines_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_purchase_order_lines
    ADD CONSTRAINT supply_purchase_order_lines_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: supply_purchase_order_lines supply_purchase_order_lines_purchase_order_id_supply_purchase_o; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_purchase_order_lines
    ADD CONSTRAINT supply_purchase_order_lines_purchase_order_id_supply_purchase_o FOREIGN KEY (purchase_order_id) REFERENCES public.supply_purchase_orders(id) ON DELETE CASCADE;


--
-- Name: supply_purchase_orders supply_purchase_orders_vendor_id_supply_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_purchase_orders
    ADD CONSTRAINT supply_purchase_orders_vendor_id_supply_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.supply_vendors(id);


--
-- Name: supply_receipt_lines supply_receipt_lines_receipt_id_supply_receipts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_receipt_lines
    ADD CONSTRAINT supply_receipt_lines_receipt_id_supply_receipts_id_fk FOREIGN KEY (receipt_id) REFERENCES public.supply_receipts(id) ON DELETE CASCADE;


--
-- Name: supply_receipt_lines supply_receipt_lines_shipment_line_id_supply_shipment_lines_id_; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_receipt_lines
    ADD CONSTRAINT supply_receipt_lines_shipment_line_id_supply_shipment_lines_id_ FOREIGN KEY (shipment_line_id) REFERENCES public.supply_shipment_lines(id);


--
-- Name: supply_receipts supply_receipts_shipment_id_supply_procurement_shipments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_receipts
    ADD CONSTRAINT supply_receipts_shipment_id_supply_procurement_shipments_id_fk FOREIGN KEY (shipment_id) REFERENCES public.supply_procurement_shipments(id);


--
-- Name: supply_shipment_lines supply_shipment_lines_purchase_order_line_id_supply_purchase_or; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_shipment_lines
    ADD CONSTRAINT supply_shipment_lines_purchase_order_line_id_supply_purchase_or FOREIGN KEY (purchase_order_line_id) REFERENCES public.supply_purchase_order_lines(id);


--
-- Name: supply_shipment_lines supply_shipment_lines_shipment_id_supply_procurement_shipments_; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_shipment_lines
    ADD CONSTRAINT supply_shipment_lines_shipment_id_supply_procurement_shipments_ FOREIGN KEY (shipment_id) REFERENCES public.supply_procurement_shipments(id) ON DELETE CASCADE;


--
-- Name: supply_shipments supply_shipments_vendor_id_supply_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_shipments
    ADD CONSTRAINT supply_shipments_vendor_id_supply_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.supply_vendors(id);


--
-- Name: supply_vendor_bills supply_vendor_bills_purchase_order_id_supply_purchase_orders_id; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.supply_vendor_bills
    ADD CONSTRAINT supply_vendor_bills_purchase_order_id_supply_purchase_orders_id FOREIGN KEY (purchase_order_id) REFERENCES public.supply_purchase_orders(id);


--
-- Name: task_assignments task_assignments_task_id_collaborative_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_task_id_collaborative_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.collaborative_tasks(id) ON DELETE CASCADE;


--
-- Name: task_assignments task_assignments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_sales_rep_id_sales_reps_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_sales_rep_id_sales_reps_id_fk FOREIGN KEY (sales_rep_id) REFERENCES public.sales_reps(id) ON DELETE SET NULL;


--
-- Name: workspace_action_points workspace_action_points_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.workspace_action_points
    ADD CONSTRAINT workspace_action_points_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: workspace_action_points workspace_action_points_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: morris
--

ALTER TABLE ONLY public.workspace_action_points
    ADD CONSTRAINT workspace_action_points_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict psGKLJC9CK7h24wvjT4UuEV9xuwLeNn78srP7WcXsoUx8GmuXhuysUfR8RAHEH6

