# GATE UI Polish (Etkinlik & Konser)

## Changes
- Gate dogrulama ekraninda durum mesaji buyuk baslik + kisa aciklama olarak ayrildi.
- not_claimed, invalid_code, already_used ve valid mesajlari netlestirildi.
- Loading/empty/network error halleri eklendi (dogrulaniyor, bos liste, ag hatasi).
- Operator icin son dogrulamalar listesi + status badge + timestamp eklendi.
- Metinler tek yerde toplandi: app/gate/gateCopy.ts
- Status mapping tek fonksiyonda toplandi: app/gate/gateStatus.ts

## Status -> UI mapping
| API reason / durum | UI key | Baslik | Badge | Ton |
| --- | --- | --- | --- | --- |
| valid | VALID | Gecerli | GECERLI | success |
| invalid_code | INVALID_CODE | Gecersiz kod | GECERSIZ KOD | danger |
| not_claimed | NOT_CLAIMED | Bilet henuz teslim alinmamis | CLAIM EDILMEMIS | warning |
| already_used | ALREADY_USED | Bilet daha once kullanilmis | KULLANILMIS | warning |
| missing_code | MISSING_CODE | Claim kodu eksik | KOD EKSIK | warning |
| unauthorized | UNAUTHORIZED | Yetkisiz | YETKISIZ | danger |
| network_error (client) | NETWORK_ERROR | Ag hatasi | AG HATASI | danger |
| missing_operator_key (client) | MISSING_OPERATOR_KEY | Operator anahtari eksik | OPERATOR EKSIK | warning |
| missing_fields (client) | MISSING_FIELDS | Eksik bilgi | EKSIK BILGI | warning |
| loading (client) | LOADING | Dogrulaniyor... | DOGRULANIYOR | neutral |
| unknown / fallback | UNKNOWN | Hazir | HAZIR | neutral |

## Screenshot list
- [ ] Gate Verify - valid
- [ ] Gate Verify - invalid_code
- [ ] Gate Verify - not_claimed
- [ ] Gate Verify - already_used (last used info)
- [ ] Gate Verify - network error
- [ ] Operator list - empty state
- [ ] Operator list - populated
