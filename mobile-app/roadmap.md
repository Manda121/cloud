# dossier a creer:
    New-Item -ItemType Directory -Path "E:\ITU_S5\mr_Rojo\CLOUD\title-server\data\database" -Force
    New-Item -ItemType Directory -Path "E:\ITU_S5\mr_Rojo\CLOUD\title-server\data\tiles" -Force
    New-Item -ItemType Directory -Path "E:\ITU_S5\mr_Rojo\CLOUD\title-server\data\style" -Force

# fichier a placer dans data : antananarivo.osm.pbf
   
# renommer le nom du fichier :
> **Note:** les lignes suivantes sont des commandes PowerShell — ne copiez pas le trait d'union `-` des listes.
```powershell
Move-Item "E:\ITU_S5\mr_Rojo\CLOUD\title-server\data\region.osm.pbf" `
  "E:\ITU_S5\mr_Rojo\CLOUD\title-server\data\region.osm.pbf" -Force
```

# installer l'image officielle dans docker:
```powershell
docker pull overv/openstreetmap-tile-server
```

# importer les données dans docker
```powershell
docker run --rm -e THREADS=4 -v "E:\ITU_S5\mr_Rojo\CLOUD\title-server\data:/data" --entrypoint /run.sh overv/openstreetmap-tile-server import
```

# lancer le serveur
```powershell
docker run -v "E:\ITU_S5\mr_Rojo\CLOUD\title-server\data:/data" -p 8080:80 overv/openstreetmap-tile-server run
```