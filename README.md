# Balanced Voting System (BVS)

A BVS egy Solidity-ban megírt, ethereum blockchain hálózatokkal kompatibilis okosszerződés, ami lehetővé teszi, hogy az államigazgatás és politikai döntéshozatal gyakorlata egy sokkal kiegyensúlyozottabb (fékek és ellensúlyok), ésszerűbb és egyben hatékonyabb formában tudjon megvalósulni a 21. századi társadalmainkban.

## Mégis, pontosan mit tud a BVS?

A múltban és korunkban is a hatalommal, döntéshozatali szerepkörrel való jó-, vagy éppen rosszhiszemű visszaélések, tévedések karöltve a tömegmanipulációs eszközök térnyerésével, az olyan jelenségekkel, mint az információs buborék effektus, az inga effektus, mind-mind kártékony tönetekként fejtették ki negatív hatásukat a társadalmak életére és működésére. Válságok, háborúk, elnyomás, kizsákmányolás, gazdag és szegény közötti olló szélesedése... ezek mind sok esetben visszavezethetőek az önérdek, az inkompetencia, a tájékozatlanság - tanulatlanság, a fanatizmus - elvakultság térnyerésére.

A BVS erre a civilizációk kezdete óta sorsunkat kísérő jelenségre kínál megoldást.

A rendszer lényege, hogy struktúrájából, természetéből fakadóan szigorú kereteket biztosítson egy adott társadalmi közösség döntéshozatali gyakorlatának megvalósításához. A BVS okosszerződés résztvevőit állampolgárok, politikusok és adminisztrátorok alkotják, valamint a külső támogatók.

A BVS-ben a választások során politikai vezetői szerepre emelkedett állampolgárok támogatottságuk %-os arányában havonta kezdeményezhetnek súlyozott "nép"szavazásokat bármilyen témában.

Ezekre a népszavazásra/népi jóváhagyásra bocsátott témákra a többi (legalább 5% szavazati támogatottsággal bíró) politikai vezető támogatói, vagy éppen kritizáló véleménycikkek formájában reagálhat. Ezen kritikákra a szavazást kiíró politikusnak egy rövidebb válasz komment cikkben reagálnia kell - hasonlóan a parlamenti viták szerkezetéhez.

Minden szavazást, vélemény cikket, kommentet az adminisztrátorok ellenőriznek és hagynak jóvá. Ezen túl az adminisztrátorok testreszabott teszt kérdéseket + titkosított (hash-elt) válaszokat is létrehoznak az adott tartalomhoz.

Az adott szavazás következő szakaszában az állampolgáron a sor. Mindenkinek a szavazati rétéke annak függvényében alakúl, hogy mennyire sokrétűen és kétoldalúan (pro - con) tájékozódott a szavazás témájáról és az arra adott politikai szereplóktól érkező kritikákra. A rendszert azt díjjazza a legjobban, ha egy állampolgár elsősorban arra törekszik, hogy egyenlő arányban ismerje meg a támogatói és az ellenzői véleményeket. Ez a beépített logika egy erős ösztönző az elfogulatlanabb véleményalkotás (szavazat leadása) megteremtésére a szavazók körében.

### Ezt az alábbi matemaikai formula garantálja:

tc = támogatói cikkek száma
ec = támogatói cikkek száma

tr = támogatói cikkekre adott reakció kommentek
er = ellenző cikkekre adott reakció kommentek

**Szavazati pontszám** = 5 + (tc + ec - |tc - ec|) / 2 * 25 + |tc - ec| * 5 + (tr + er - |tr - er|) / 2 * 10 + |tr - er| * 2





A BVS okosszerződésből egy új példányt, néhány egyszerű lépéssel bármilyen társadalmi-politikai közösség létrehozhat maga számára.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```
