-- Deja AKR_ConfigACO con los parámetros validados en el piloto.
-- Ejecutar una vez en la base de datos (local o Azure SQL) después de desplegar
-- la versión que aplica la configuración guardada al cálculo de rutas.
UPDATE AKR_ConfigACO SET Valor = 1.0  WHERE Clave = 'alfa';
UPDATE AKR_ConfigACO SET Valor = 3.5  WHERE Clave = 'beta';
UPDATE AKR_ConfigACO SET Valor = 0.25 WHERE Clave = 'rho';
UPDATE AKR_ConfigACO SET Valor = 1.0  WHERE Clave = 'Q';
UPDATE AKR_ConfigACO SET Valor = 12   WHERE Clave = 'numAnts';
UPDATE AKR_ConfigACO SET Valor = 100  WHERE Clave = 'iterations';
UPDATE AKR_ConfigACO SET Valor = 5    WHERE Clave = 'elite';
UPDATE AKR_ConfigACO SET Valor = 0.01 WHERE Clave = 'tauMin';
SELECT Clave, Valor FROM AKR_ConfigACO;
