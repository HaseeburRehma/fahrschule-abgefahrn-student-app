-- Many clients hit the same limiter key at once: exactly p_limit may pass.
select allowed from public.check_rate_limit('race:test', 100, 3600);
