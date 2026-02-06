# Bilet Yaşam Döngüsü — Etkinlik & Konser

## Overview
- Platformun amacı: biletin satın alma, doğrulama ve giriş akışını güvenli ve hızlı yönetmek.
- Altyapı merkeziyetsiz doğrulama sağlar, fakat kullanıcı deneyimi sade ve tek adımlıdır.

## A) Satın Alma / Mint (Invisible Claim default)
1. Kullanıcı ödeme yapar (fiat/crypto).
2. Backend bir `TicketIntent` oluşturur.
3. İmza alınır (kullanıcı veya relayer).
4. Smart contract:
   - NFT mint eder.
   - `eventId` on-chain yazılır.
5. Sistem üretir:
   - `tokenId`, `orderId`.
6. **Invisible claim**:
   - Varsayılan akışta sistem otomatik claim eder.
   - Kullanıcıdan ekstra adım istenmez.

## B) Claim (Opsiyonel / Edge-case)
- **Ne zaman gerekir:**
  - Transfer/secondary market
  - Email ile gönderim
  - Gecikmeli aktivasyon
- **Not:** Default UX’te kapalıdır.

## C) Gate Verify (Giriş Kontrolü)
- Operator, Gate ekranından girer:
  - Operator key
  - EventId + TokenId (+ opsiyonel claim code)
- **Kontrol sırası:**
  1. Operator key
  2. Rate limit
  3. Temporary lock
  4. Event match
  5. Claimed durumu
  6. Already used
- **Sonuçlar:**
  - `valid` → giriş onaylanır
  - Diğerleri → net sebep ile reddedilir

## D) Kullanım Sonrası
- `used=true`
- Tekrar giriş mümkün değil
- Tüm denemeler audit log’a düşer

## Security & Trust
- On-chain doğrulama
- Replay/abuse korumaları
- Audit logs (dev-only viewer; prod kapalı)

## FAQ (Short)
- **“Claim neden görünmez?”**
  - Kullanıcı deneyimini sade tutmak için varsayılan akışta sistem otomatik claim eder.
- **“Biletimi transfer edersem?”**
  - Transfer/secondary market senaryosunda claim opsiyonel olarak devreye girer.
- **“Gate’te neden reddedildi?”**
  - Operator key, event eşleşmesi, claimed durumu veya used kontrolünden biri başarısız olmuştur.

---

# PDF DRAFT — Bilet Yaşam Döngüsü (Etkinlik & Konser)

## Overview
Platformun amacı, biletin satın alma, doğrulama ve giriş akışını güvenli ve hızlı yönetmektir. Altyapı merkeziyetsiz doğrulama sağlar, ancak kullanıcıya sade ve tek adımlı bir deneyim sunar.

## A) Satın Alma / Mint (Invisible Claim default)
Kullanıcı ödeme yapar (fiat/crypto). Backend bir `TicketIntent` oluşturur ve imza alınır (kullanıcı veya relayer). Smart contract NFT mint eder ve `eventId` on-chain yazılır. Sistem `tokenId` ve `orderId` üretir. Varsayılan akışta **invisible claim** otomatik çalışır; kullanıcıdan ekstra adım istenmez.

## B) Claim (Opsiyonel / Edge-case)
Claim yalnızca opsiyonel/edge-case senaryolarda gerekir: transfer/secondary market, email ile gönderim veya gecikmeli aktivasyon. Default UX’te kapalıdır.

## C) Gate Verify (Giriş Kontrolü)
Operator Gate ekranında operator key ve eventId + tokenId girer (opsiyonel claim code dahil edilebilir). Kontrol sırası: operator key, rate limit, temporary lock, event match, claimed durumu, already used. Sonuç `valid` ise giriş onaylanır; diğer durumlarda net bir gerekçe ile reddedilir.

## D) Kullanım Sonrası
Bilet `used=true` olur ve tekrar giriş mümkün değildir. Tüm denemeler audit log’a kaydedilir.

## Security & Trust
On-chain doğrulama kullanılır. Replay/abuse korumaları aktiftir. Audit logs yalnızca dev viewer’da görünür; prod ortamında kapalıdır.

## FAQ (Short)
**Claim neden görünmez?** Varsayılan akışta sistem otomatik claim eder ve kullanıcıdan ekstra adım istenmez.

**Biletimi transfer edersem?** Transfer/secondary market senaryosunda claim opsiyonel olarak devreye girer.

**Gate’te neden reddedildi?** Operator key, event eşleşmesi, claimed durumu veya used kontrolünden biri başarısız olmuştur.
