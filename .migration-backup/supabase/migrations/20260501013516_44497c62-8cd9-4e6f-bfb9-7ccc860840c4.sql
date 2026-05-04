
-- Validation trigger for plan_features
CREATE OR REPLACE FUNCTION public.validate_plan_feature_min_months()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requires_min_months IS NOT NULL THEN
    IF NEW.requires_min_months < 0 OR NEW.requires_min_months > 120 THEN
      RAISE EXCEPTION 'requires_min_months must be between 0 and 120, got %', NEW.requires_min_months;
    END IF;
    IF NEW.requires_min_months != TRUNC(NEW.requires_min_months) THEN
      RAISE EXCEPTION 'requires_min_months must be an integer, got %', NEW.requires_min_months;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_plan_feature_min_months
  BEFORE INSERT OR UPDATE ON public.plan_features
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_plan_feature_min_months();

-- Validation trigger for plan_themes
CREATE OR REPLACE FUNCTION public.validate_plan_theme_min_months()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requires_min_months IS NOT NULL THEN
    IF NEW.requires_min_months < 0 OR NEW.requires_min_months > 120 THEN
      RAISE EXCEPTION 'requires_min_months must be between 0 and 120, got %', NEW.requires_min_months;
    END IF;
    IF NEW.requires_min_months != TRUNC(NEW.requires_min_months) THEN
      RAISE EXCEPTION 'requires_min_months must be an integer, got %', NEW.requires_min_months;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_plan_theme_min_months
  BEFORE INSERT OR UPDATE ON public.plan_themes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_plan_theme_min_months();
