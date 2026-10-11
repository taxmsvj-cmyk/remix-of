CREATE TABLE public.circulars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL UNIQUE,
  kind text, number text, reg_date text, subject text, content text,
  url text NOT NULL DEFAULT '', query_term text, issuer text, status text,
  related_articles text, interpretation text, source_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.circulars TO anon, authenticated;
GRANT ALL ON public.circulars TO service_role;
ALTER TABLE public.circulars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "circulars public read" ON public.circulars FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX circulars_fts ON public.circulars USING gin (to_tsvector('simple', coalesce(subject,'')||' '||coalesce(related_articles,'')||' '||coalesce(content,'')));

CREATE TABLE public.memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'upload',
  source_ref text,
  extracted_text text,
  summary text,
  reasoning text,
  key_points text[] NOT NULL DEFAULT '{}',
  articles text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_items TO authenticated;
GRANT ALL ON public.memory_items TO service_role;
ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory select" ON public.memory_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own memory insert" ON public.memory_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own memory update" ON public.memory_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own memory delete" ON public.memory_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX memory_items_fts ON public.memory_items USING gin (to_tsvector('simple', coalesce(title,'')||' '||coalesce(summary,'')||' '||coalesce(reasoning,'')||' '||coalesce(extracted_text,'')));

CREATE TABLE public.memory_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_id uuid NOT NULL REFERENCES public.memory_items(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_ref text NOT NULL,
  relation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.memory_links TO authenticated;
GRANT ALL ON public.memory_links TO service_role;
ALTER TABLE public.memory_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own links select" ON public.memory_links FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own links insert" ON public.memory_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own links delete" ON public.memory_links FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.search_knowledge(q text, lim int DEFAULT 8)
RETURNS TABLE(kind text, ref_id text, title text, snippet text, url text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  (SELECT 'memory', m.id::text, m.title, left(coalesce(m.summary,'')||' '||coalesce(m.reasoning,''), 1500), coalesce(m.source_ref,'')
   FROM memory_items m
   WHERE to_tsvector('simple', coalesce(m.title,'')||' '||coalesce(m.summary,'')||' '||coalesce(m.reasoning,'')||' '||coalesce(m.extracted_text,'')) @@ plainto_tsquery('simple', q)
      OR EXISTS (SELECT 1 FROM unnest(m.articles) a WHERE q ILIKE '%'||a||'%')
   ORDER BY m.created_at DESC LIMIT lim)
  UNION ALL
  (SELECT 'circular', c.source_id, coalesce(c.number,'')||' — '||coalesce(c.subject,''), left(coalesce(c.interpretation, c.content, ''), 1500), c.url
   FROM circulars c
   WHERE to_tsvector('simple', coalesce(c.subject,'')||' '||coalesce(c.related_articles,'')||' '||coalesce(c.content,'')) @@ plainto_tsquery('simple', q)
   LIMIT lim)
$$;
GRANT EXECUTE ON FUNCTION public.search_knowledge(text,int) TO authenticated;