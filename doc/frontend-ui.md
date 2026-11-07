# Frontend UI ve pratik tasarım standartları

## Ortak tasarım kaynağı

- Renk, radius ve yazı tipi tokenları: `frontend/src/styles.css`. Yazı tipleri
  `@fontsource-variable` paketlerinden yerel olarak yüklenir; üçüncü taraf font isteği yapılmaz.
- `primary`: ana aksiyon ve seçili kontrol. `success`: doğru cevap veya olumlu
  öz değerlendirme. `destructive`: yanlış cevap, hata ve silme işlemi.
- Sayfa yerleşimi: `page-shell`; pratik ekranında `data-width="practice"` ile
  daha dar okuma alanı. Koleksiyon listelerinde `collection-grid` kullanılır.
- Mod seçimi: shadcn `Label` ve `RadioGroupItem` üzerine `selection-card` uygulanır.
  Görünüm `data-selected` ve `data-disabled` durumlarından türetilir.
- Kontroller `frontend/src/components/ui` içindeki resmi shadcn kaynaklarından
  gelir (Base UI, `base-vega` stili). Yeni bir kontrol gerektiğinde mevcut
  `components.json` ile resmi CLI üzerinden eklenir. Uygulamaya özgü ortak akışlar,
  bu kontrolleri birleştirir. Base UI'da `asChild` yerine `render` kullanılır;
  bağlantıları buton gibi göstermek için `buttonVariants()` sınıfları kullanılır.
- `@shadcn/lint` kuralları (Oxlint içinde) ham Tailwind renklerini, bilinmeyen
  sınıfları ve dinamik sınıf dizelerini reddeder; keyfi değerler uyarı verir.
- Formlar TanStack Form + shadcn `Field` bileşenleriyle kurulur
  (`src/components/form.tsx`); doğrulama `@clozera/shared` içindeki Zod şemalarını
  kullanır, böylece API ile aynı kurallar uygulanır.

## Koleksiyon kartları

Kartlarda sırasıyla koleksiyon türü/seviyesi, başlık, açıklama, cümle sayısı ve
aksiyonlar gösterilir. Başlık ve ok butonu cümle listesine gider; metinli
`Practice` butonu pratik ayarlarını açar. Sabitleme ayrı, erişilebilir adı olan
bir aksiyondur. Boş koleksiyonlarda pratik kapalı, cümle listesi erişilebilir kalır.

Henüz backend'de tutulmayan öğrenme yüzdeleri, mastery veya geçmiş istatistikleri
kartlarda gösterilmez. Arama alanı görünür kalır; sıralama ad veya cümle sayısına
uygulanır. Mobilde kartlar ve cevap alanları tek sütuna geçer.

Sekme ve arama metni URL'de tutulur (`/dashboard?tab=collections&q=...`); geri
gidildiğinde aynı görünüm ve kaydırma konumu geri gelir. Sıralama, açık resmi grup
başlıkları ve son seçilen pratik modu/oturum uzunluğu cihazda (Zustand `persist`)
saklanır. Dashboard'daki "Practice material" grafiği (TanStack Charts) sabitlenmiş
koleksiyonların cümle sayılarını sıralı yatay çubuklarla ve ekran okuyucu için
tablo eşdeğeriyle gösterir.

Koleksiyon açıklamaları ve cümle notları Markdown olarak (TanStack Markdown)
gösterilir; topluluk içerikleri başka öğrenicilerden geldiği için ham HTML kapalıdır.
Cümle listesi TanStack Table ile aranır ve sayfalanır (25 satır).

## Pratik mimarisi

- `src/lib/practice-session.ts`: framework bağımsız cevap kontrolü, karıştırma,
  mod doğrulama ve oturum uzunluğu seçenekleri.
- `src/lib/practice-options.ts`: mod ve pratik türlerinin ortak adları,
  açıklamaları, ikonları, yönergeleri ve kullanılabilirlik durumu.
- `src/hooks/use-practice-session.ts`: soru ilerletme, cevap açma, değerlendirme
  ve yeniden başlatma davranışı (`useReducer`). Cümleler route loader'ında TanStack
  DB koleksiyonuna önceden yüklenir.
- `src/components/practice-dialog.tsx`: seçenekleri shadcn radio/select kontrolleriyle sunar.
- `src/routes/_app/dashboard/collections/$collectionId/practice.tsx`: aynı oturum
  davranışını seçilen cevap moduna göre sunar.

Desteklenen modlar:

| URL `mode` değeri | Kullanıcı davranışı | Oturum sonucu |
| --- | --- | --- |
| `choice` | Mevcut seçeneklerden cevabı seçer. | Doğru / yanlış |
| `typed` | Cevabı yazar; alternatif doğru cevaplar kabul edilir. | Doğru / yanlış |
| `flashcard` | Cevabı açar, ardından hatırlayıp hatırlamadığını değerlendirir. | Hatırlanan / tekrar çalışılacak |

`limit` parametresi 5, 10 veya 20 olabilir; geçersiz veya eksik değer 10 kabul
edilir. Koleksiyonda daha az cümle varsa tamamı kullanılır. Her yeniden başlatmada
rastgele bir set seçilir. Flashcard öz değerlendirmesi otomatik doğruluk ölçümü
olarak sunulmaz. Sonuçlar yalnızca mevcut oturumda tutulur; backend'e yazılmaz.

## Dinleme için hazırlık

Pratik türü, cevap modundan ayrıdır: `reading` (Vocabulary) cümlenin okunmasını,
gelecekteki `listening` ise sesle sunulmasını ifade eder. Böylece dinleme daha
sonra çoktan seçmeli veya yazarak cevapla birleştirilebilir.

Şimdilik yalnızca `reading` kullanılabilir. `listening`, ortak seçenek tanımında
`available: false` olarak yer alır ve arayüzde gelecek özellik olarak gösterilir.
Ses çalma, tarayıcı TTS, mikrofon erişimi veya yeni backend endpoint'i eklenmemiştir.

Dinleme etkinleştirilmeden önce cümlelerin ses kaynağı, oynatma/hata durumları,
tekrar dinleme davranışı ve metnin ne zaman gösterileceği tasarlanmalıdır.
Sadece kullanılabilirlik bayrağını değiştirmek özelliği tamamlamaz.

## Erişilebilirlik ve doğrulama

- İkon butonlarında açıklayıcı ad; formlarda bağlı label; seçimlerde gerçek
  shadcn radio/select kontrolleri kullanılır.
- Cevap geri bildirimi renk yanında metin ve ikon içerir. Değerlendirmeden sonra
  odak sonraki aksiyona taşınır. Flashcard cevabı açılmadan öz değerlendirme yapılamaz.
- Çoktan seçmeli cevaplarda 1–4 tuşları, sayfa açıldığında veya sonraki soruya
  geçildiğinde ayrıca bir cevap butonuna odaklanmadan kullanılabilir. Dinleyici
  yalnızca aktif soruyu değerlendirir; metin alanları, açık menü/dialoglar, IME,
  basılı tutulan tuş tekrarları ve Ctrl/Alt/Meta kısayolları engellenmez.
- Kontrol komutları: `npm test -w frontend`, `npm run build -w frontend`,
  `npm run check -w frontend`, `npm run typecheck -w frontend`.


## Cümle içi cevap alanı

Yazılı cevapta shadcn `Input`, eksik kelimenin yerinde gösterilir ve HTML `form`
özelliğiyle alttaki tek aksiyon butonuna bağlanır. Input genişliği doğru cevabın
uzunluğundan değil, kullanıcının yazdığı metinden türetilir. Böylece cevap
uzunluğu önceden açığa çıkmaz. Çok uzun girişler alanın içinde kaydırılır.

`cloze-input`, `cloze-blank` ve `cloze-answer` stilleri aynı metin hizasını ve
kompakt görünümü kullanır. Yazılmayan boşluk tek kesintisiz çizgidir; alt çizgi
karakterleri kullanılmaz. Kontrol sonrasında sonuç cümlede renk ve kısa ikonlu
metinle gösterilir. Yanlış cevapta doğru kelime cümleye yerleşir; kullanıcının
cevabı kısa bir satırda korunur. Ayrı bir sonuç kartı oluşturulmaz.

Aynı buton önce `Check answer`, sonra `Next sentence` veya `Finish session`
olur. Enter bu iki adımı da çalıştırır; IME kompozisyonu sırasında Enter cevabı
göndermez. Yeni soruda odak yeniden cümledeki cevap alanına geçer.


## Marka görselleri

Navbar'da `public/brand/clozera-wordmark.png` kullanılır. Bu dosya, seçilmiş açık
zemin logosunun optimize edilmiş şeffaf PNG kopyasıdır; mevcut açık arayüz teması
ile kullanılır. Link erişilebilir bir ad taşır ve görüntü için boyutlar tanımlıdır.

Kök route (`src/routes/__root.tsx`), açık ve koyu tarayıcı temaları için ayrı favicon PNG dosyalarını
`prefers-color-scheme` media sorgusuyla seçer. ICO varsayılan sürümü ve kökteki
`favicon.ico`/`favicon.png` dosyaları eski istemciler için korunur. Tarayıcı
sekmesinin teması, uygulamanın arayüz temasından bağımsızdır; sistem koyu modda
olsa da mevcut açık navbar'a beyaz wordmark yüklenmez.

Seçilen tasarım dosyaları ve koyu wordmark'ın mevcut sınırı için
`design/brand/wordmark-v1/README.md` dosyasına bak.
