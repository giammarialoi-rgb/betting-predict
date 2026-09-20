/**
 * PESO EFFICACE — quanta squadra c'è davvero dentro una previsione.
 *
 * Il modello stima la forza di una squadra dalle sue partite NELLA DIVISIONE in
 * cui gioca, pesate con dimezzamento temporale, e poi tira la stima verso la
 * media di lega con uno shrinkage di k partite equivalenti. La formula è
 * quella, e ha una conseguenza che il numero finale non mostra:
 *
 *     stima = (peso * osservato + k * media_lega) / (peso + k)
 *
 * Quando il peso efficace è molto sotto k, la previsione è in prevalenza la
 * MEDIA DEL CAMPIONATO, non la squadra. Non è un difetto dello shrinkage: è lo
 * shrinkage che fa il suo mestiere in assenza di informazione. Il difetto è
 * usare quel numero come se fosse una previsione sulla squadra.
 *
 * Il caso che ha portato a questo modulo: Frosinone - Como, 20/09/2026. Il
 * modello dava il Frosinone al 26.6% contro il 15% del mercato, e sembrava un
 * vantaggio del 75%. Frosinone aveva peso efficace 4.11 contro uno shrinkage di
 * 9: oltre due terzi della sua stima era la media della Serie A. Il modello non
 * stava dicendo "il Frosinone è forte", stava dicendo "non so chi sia il
 * Frosinone". Il mercato lo sapeva benissimo — neopromossa con rosa da Serie B.
 *
 * La differenza tra i due numeri non era vantaggio: era ignoranza del modello
 * scambiata per vantaggio. Questo modulo la rende misurabile, e quindi
 * filtrabile, prima che finisca dentro un biglietto.
 */

/** Frazione di sé stessa che una partita conserva dopo `ageDays`. */
export function decayWeight(ageDays: number, halfLifeDays: number): number {
  if (!(halfLifeDays > 0)) {
    throw new Error(`emivita non valida: ${halfLifeDays}`);
  }
  if (!Number.isFinite(ageDays) || ageDays < 0) return 0;
  // Oltre otto dimezzamenti il contributo è sotto lo 0.4%: si azzera, come fa
  // il modello, per non trascinare code irrilevanti.
  if (ageDays > halfLifeDays * 8) return 0;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Somma dei pesi delle partite di una squadra nella divisione considerata.
 * È il "quante partite equivalenti" il modello ha davvero sotto la stima.
 */
export function effectiveSample(
  matchDatesMs: readonly number[],
  asOfMs: number,
  halfLifeDays: number,
): number {
  let total = 0;
  for (const t of matchDatesMs) {
    if (!Number.isFinite(t)) continue;
    total += decayWeight((asOfMs - t) / 86_400_000, halfLifeDays);
  }
  return total;
}

/**
 * Quanta parte della stima viene dalla squadra e non dalla media di lega.
 * Zero = tutta media, uno = tutta squadra.
 */
export function informationShare(effective: number, shrinkage: number): number {
  if (!(shrinkage > 0)) throw new Error(`shrinkage non valido: ${shrinkage}`);
  if (!(effective >= 0)) throw new Error(`peso efficace non valido: ${effective}`);
  return effective / (effective + shrinkage);
}

/**
 * Soglia sotto la quale una selezione non entra in un biglietto.
 *
 * Fissata a metà informazione: sotto, la previsione è per più della metà la
 * media del campionato, e uno scarto dal mercato dice più su quanto NON
 * sappiamo che su quanto sappiamo. Con shrinkage 9 significa peso efficace 9.
 */
export const MIN_INFORMATION_SHARE = 0.5;

export function isInformative(
  effective: number,
  shrinkage: number,
  minShare = MIN_INFORMATION_SHARE,
): boolean {
  return informationShare(effective, shrinkage) >= minShare;
}
