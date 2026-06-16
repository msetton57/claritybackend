--
-- PostgreSQL database dump
--

\restrict 0epaXSKbfQPM9t1tdte3iZNV4bAK3loy9vGh1fwIfqnpZhf8VTQAUkDNAfBnbou

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

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
-- Name: ekgx_leads; Type: TABLE; Schema: public; Owner: postgres
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
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ekgx_leads_status_check CHECK ((status = ANY (ARRAY['contacted'::text, 'not_contacted'::text])))
);


ALTER TABLE public.ekgx_leads OWNER TO postgres;

--
-- Name: ekgx_leads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ekgx_leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ekgx_leads_id_seq OWNER TO postgres;

--
-- Name: ekgx_leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ekgx_leads_id_seq OWNED BY public.ekgx_leads.id;


--
-- Name: shipping_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipping_policies (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    carrier text,
    shipping_method text NOT NULL,
    shipping_cost numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shipping_policies OWNER TO postgres;

--
-- Name: shipping_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shipping_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipping_policies_id_seq OWNER TO postgres;

--
-- Name: shipping_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shipping_policies_id_seq OWNED BY public.shipping_policies.id;


--
-- Name: supply_activity_events; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.supply_activity_events OWNER TO postgres;

--
-- Name: supply_activity_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supply_activity_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_activity_events_id_seq OWNER TO postgres;

--
-- Name: supply_activity_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supply_activity_events_id_seq OWNED BY public.supply_activity_events.id;


--
-- Name: supply_documents; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.supply_documents OWNER TO postgres;

--
-- Name: supply_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supply_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supply_documents_id_seq OWNER TO postgres;

--
-- Name: supply_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supply_documents_id_seq OWNED BY public.supply_documents.id;


--
-- Name: workspace_documents; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.workspace_documents OWNER TO postgres;

--
-- Name: workspace_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workspace_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspace_documents_id_seq OWNER TO postgres;

--
-- Name: workspace_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workspace_documents_id_seq OWNED BY public.workspace_documents.id;


--
-- Name: workspace_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_folders (
    id integer NOT NULL,
    name text NOT NULL,
    parent_id integer,
    created_by text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_folders OWNER TO postgres;

--
-- Name: workspace_folders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workspace_folders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspace_folders_id_seq OWNER TO postgres;

--
-- Name: workspace_folders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workspace_folders_id_seq OWNED BY public.workspace_folders.id;


--
-- Name: ekgx_leads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ekgx_leads ALTER COLUMN id SET DEFAULT nextval('public.ekgx_leads_id_seq'::regclass);


--
-- Name: shipping_policies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_policies ALTER COLUMN id SET DEFAULT nextval('public.shipping_policies_id_seq'::regclass);


--
-- Name: supply_activity_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supply_activity_events ALTER COLUMN id SET DEFAULT nextval('public.supply_activity_events_id_seq'::regclass);


--
-- Name: supply_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supply_documents ALTER COLUMN id SET DEFAULT nextval('public.supply_documents_id_seq'::regclass);


--
-- Name: workspace_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_documents ALTER COLUMN id SET DEFAULT nextval('public.workspace_documents_id_seq'::regclass);


--
-- Name: workspace_folders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_folders ALTER COLUMN id SET DEFAULT nextval('public.workspace_folders_id_seq'::regclass);


--
-- Data for Name: ekgx_leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ekgx_leads (id, business_name, contact_name, email, phone, submitted_at, status, source, notes, last_contact_at, last_contact_summary, flagged, created_at, updated_at) FROM stdin;
1	Elevate Athletics	Chris Dalton	\N	(770) 555-0188	2026-06-08 12:20:00	contacted	Facebook	Looking for a fast rollout timeline before summer training programs begin.	2026-06-08 16:30:00	Left a voicemail and sent a follow-up text.	f	2026-06-16 16:16:02.557188	2026-06-16 16:16:02.557188
2	Core Motion Performance	Avery Brooks	avery@coremotion.io	(470) 555-0121	2026-06-07 17:45:00	not_contacted	Facebook	Mentioned comparing multiple vendors and wants a simple next-step plan.	\N	\N	t	2026-06-16 16:16:02.557188	2026-06-16 16:16:02.557188
3	Northside Wellness	Marcus Hill	marcus@northsidewellness.com	(678) 555-0114	2026-06-09 10:40:00	contacted	Facebook	Requested pricing details and a short implementation overview.	2026-06-09 13:05:00	Called and confirmed interest in a 15-minute intro later this week.	t	2026-06-16 16:16:02.557188	2026-06-16 16:16:02.557188
4	Harbor Fitness Studio	Janelle Price	janelle@harborfit.co	(404) 555-0192	2026-06-09 09:15:00	not_contacted	Facebook	Interested in onboarding options for a growing studio footprint.	\N	\N	f	2026-06-16 16:16:02.557188	2026-06-16 16:16:02.557188
5	Peak Recovery Lab	Sofia Bennett	sofia@peakrecoverylab.com	\N	2026-06-08 15:05:00	not_contacted	Facebook	No phone listed. Best path is email outreach first.	\N	\N	f	2026-06-16 16:16:02.557188	2026-06-16 16:16:02.557188
\.


--
-- Data for Name: shipping_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipping_policies (id, name, description, carrier, shipping_method, shipping_cost, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: supply_activity_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supply_activity_events (id, entity_type, entity_id, event_type, summary, actor_name, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: supply_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supply_documents (id, entity_type, entity_id, document_type, file_name, mime_type, size_bytes, checksum, content_base64, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: workspace_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workspace_documents (id, folder_id, title, category, description, file_name, mime_type, size_bytes, checksum, content_base64, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: workspace_folders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workspace_folders (id, name, parent_id, created_by, created_at) FROM stdin;
\.


--
-- Name: ekgx_leads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ekgx_leads_id_seq', 5, true);


--
-- Name: shipping_policies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shipping_policies_id_seq', 1, false);


--
-- Name: supply_activity_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supply_activity_events_id_seq', 1, false);


--
-- Name: supply_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supply_documents_id_seq', 1, false);


--
-- Name: workspace_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.workspace_documents_id_seq', 1, false);


--
-- Name: workspace_folders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.workspace_folders_id_seq', 1, false);


--
-- Name: ekgx_leads ekgx_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ekgx_leads
    ADD CONSTRAINT ekgx_leads_pkey PRIMARY KEY (id);


--
-- Name: shipping_policies shipping_policies_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_policies
    ADD CONSTRAINT shipping_policies_name_key UNIQUE (name);


--
-- Name: shipping_policies shipping_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_policies
    ADD CONSTRAINT shipping_policies_pkey PRIMARY KEY (id);


--
-- Name: supply_activity_events supply_activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supply_activity_events
    ADD CONSTRAINT supply_activity_events_pkey PRIMARY KEY (id);


--
-- Name: supply_documents supply_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supply_documents
    ADD CONSTRAINT supply_documents_pkey PRIMARY KEY (id);


--
-- Name: workspace_documents workspace_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_documents
    ADD CONSTRAINT workspace_documents_pkey PRIMARY KEY (id);


--
-- Name: workspace_folders workspace_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_folders
    ADD CONSTRAINT workspace_folders_pkey PRIMARY KEY (id);


--
-- Name: ekgx_leads_identity_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ekgx_leads_identity_unique ON public.ekgx_leads USING btree (business_name, contact_name, submitted_at);


--
-- Name: workspace_documents workspace_documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_documents
    ADD CONSTRAINT workspace_documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.workspace_folders(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 0epaXSKbfQPM9t1tdte3iZNV4bAK3loy9vGh1fwIfqnpZhf8VTQAUkDNAfBnbou

