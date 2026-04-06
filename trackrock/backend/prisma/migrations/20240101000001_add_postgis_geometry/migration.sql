-- Enable PostGIS extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to Property table for spatial queries
SELECT AddGeometryColumn('public', 'Property', 'geom', 4326, 'POINT', 2);

-- Spatial index for fast bbox queries
CREATE INDEX "Property_geom_idx" ON "Property" USING GIST(geom);

-- Trigger: auto-populate geom from lat/lng on insert/update
CREATE OR REPLACE FUNCTION sync_property_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  ELSE
    NEW.geom = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_geom_trigger
  BEFORE INSERT OR UPDATE ON "Property"
  FOR EACH ROW EXECUTE FUNCTION sync_property_geom();
