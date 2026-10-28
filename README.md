# Table de poker entre amis (jetons virtuels, 6 places max)
Modes : Texas Hold'em No-Limit, Omaha Pot-Limit, ou « Choix du donneur » (le bouton choisit avant chaque main, 20 s, sinon variante précédente).
Réglages (engine.js → CONFIG) : pile 5 000, recave au choix +1 000 à +5 000 (par 1 000), 6 sièges, blindes 100/200, unité 100.
Jetons 1 500 (violet) / 200 (bleu) / 100 (blanc), monnaie rendue automatiquement ; mise en touchant les jetons ou avec le curseur.

## Lancer / redémarrer
    ./start.sh        # superviseur (relance auto si crash) + tunnel cloudflared, affiche l'URL (url.txt)
    ./supervise.sh    # serveur seul supervisé, http://localhost:3000
    npm start         # serveur seul (PORT, DATA_FILE configurables)
    npm test          # tests moteur
    node e2e.js http://localhost:3000   # 7 clients simulés (6 assis + 1 spectateur), une main, crash/restauration
État des tables sauvegardé dans data/tables.json (piles, recaves) : un redémarrage ne perd rien (main en cours remboursée).

## Déployer ailleurs
    docker build -t poker . && docker run -p 3000:3000 -v $PWD/data:/app/data poker
Compatible Render / Railway / Fly.io (commande `npm start`, variable PORT). Prévoir un volume pour data/.

## Inviter
« Inviter par SMS » ouvre l'appli Messages du téléphone de l'hôte (lien sms:) avec le lien /t/CODE prérempli ; rien n'est envoyé automatiquement.
Aussi « Copier le lien » et « Partager ». Le 7e arrivant voit « Table complète » (spectateur). Recharger la page = même siège.
