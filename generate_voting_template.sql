-- Get all wards ordered by ward_number
SELECT DISTINCT w.id, w.ward_number 
FROM wards w 
ORDER BY w.ward_number;

-- Get all active candidates ordered by full_name  
SELECT DISTINCT c.id, c.full_name
FROM candidates c
WHERE c.is_active = true
ORDER BY c.full_name;
