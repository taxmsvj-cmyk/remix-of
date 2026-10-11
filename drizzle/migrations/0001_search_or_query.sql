CREATE OR REPLACE FUNCTION public.search_knowledge(q text, lim int DEFAULT 8)
RETURNS TABLE(kind text, ref_id text, title text, snippet text, url text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  (SELECT 'memory', m.id::text, m.title, left(coalesce(m.summary,'')||' '||coalesce(m.reasoning,''), 1500), coalesce(m.source_ref,'')
   FROM memory_items m
   WHERE to_tsvector('simple', coalesce(m.title,'')||' '||coalesce(m.summary,'')||' '||coalesce(m.reasoning,'')||' '||coalesce(m.extracted_text,'')) @@ websearch_to_tsquery('simple', q)
   ORDER BY ts_rank(to_tsvector('simple', coalesce(m.title,'')||' '||coalesce(m.summary,'')||' '||coalesce(m.reasoning,'')||' '||coalesce(m.extracted_text,'')), websearch_to_tsquery('simple', q)) DESC LIMIT lim)
  UNION ALL
  (SELECT 'circular', c.source_id, coalesce(c.number,'')||' — '||coalesce(c.subject,''), left(coalesce(c.interpretation, c.content, ''), 1500), c.url
   FROM circulars c
   WHERE to_tsvector('simple', coalesce(c.subject,'')||' '||coalesce(c.related_articles,'')||' '||coalesce(c.content,'')) @@ websearch_to_tsquery('simple', q)
   ORDER BY ts_rank(to_tsvector('simple', coalesce(c.subject,'')||' '||coalesce(c.related_articles,'')||' '||coalesce(c.content,'')), websearch_to_tsquery('simple', q)) DESC
   LIMIT lim)
$$;