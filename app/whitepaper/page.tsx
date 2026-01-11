export default function WhitePaperPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-16 space-y-6">
        <h1 className="text-4xl font-semibold">White Paper</h1>

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Giriş</h2>
          <p>Etkinlik &amp; Konser platformu, yalnızca bir bilet satış sistemi değildir.</p>
          <p>Bu platform, etkinlik ekonomisinin geleceğini yeniden tanımlamak için tasarlanmış, zincir üstü çalışan, premium bir Web3 altyapısıdır.</p>
          <p>Buradaki temel fikir şudur:
            Bir bilet satın alındığında yalnızca bir koltuk değil, adil ve şeffaf bir sistem de satın alınır.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Sanat severler için yeni bir deneyim</h2>
          <p>Bir konser ya da etkinlik bileti satın almak çoğu zaman basit bir işlemdir.</p>
          <p>Ancak bu platformda bilet satın almak, aynı zamanda bilinçli bir tercihtir.</p>
          <p>Sanat severler için sağlanan avantajlar:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Ödeme nereye gidiyor sorusunun cevabı nettir</li>
            <li>Sanatçıya, organizatöre ve mekâna adil biçimde ulaştığını bilirsiniz</li>
            <li>Aracı hesaplarda bekleyen belirsiz paralar yoktur</li>
            <li>Satın alma işlemi zincir üstü olarak doğrulanabilir</li>
          </ul>
          <p>Bu sayede kullanıcı şunu hisseder:
            “Bu etkinliğe destek olurken doğru bir sistemin parçasıyım.”</p>
          <p>Bu platformu kullanan sanat sever, yalnızca izleyici değil;
            şeffaf ve adil bir ekosistemin parçasıdır.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Premium Web3 platform</h2>
          <p>Etkinlik &amp; Konser, karmaşık teknolojileri kullanıcıya yüklemez.
            Arayüz sade, güven veren ve premium bir deneyim sunar.</p>
          <p>Bu altyapı:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Gösteriş için değil</li>
            <li>Teknik detayları öne çıkarmak için değil</li>
            <li>Güven ve doğrulanabilirlik için vardır</li>
          </ul>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Sanat severler, sanatçılar, organizatörler ve mekânlar için adil sistem</h2>
          <p>Geleneksel sistemlerde ödemeler:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Tek bir hesapta toplanır</li>
            <li>Günler ya da haftalar sonra dağıtılır</li>
            <li>Manuel süreçlere ve güvene dayanır</li>
          </ul>
          <p>Bu platformda ise:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Ödeme anında dağıtım yapılır</li>
            <li>Kurallar baştan tanımlıdır</li>
            <li>Akıllı sözleşmeler süreci otomatik yürütür</li>
            <li>Her paydaş, kendi payını zincir üstü olarak görür</li>
          </ul>
          <p>Başarısız olan ödemeler çekilebilir bakiye olarak saklanır;
            diğer ödemeler otomatik olarak dağıtılır.</p>
          <p>Bu yapı sayesinde:
            Kimse kimseyi beklemez.
            Kimse kimseye güvenmek zorunda kalmaz.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Tek işlem → çoklu paydaş dağıtımı</h2>
          <p>Platformun çekirdeği bu modeldir.</p>
          <p>Bir bilet satın alındığında:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Kullanıcı tek bir ödeme yapar</li>
            <li>Sistem, önceden tanımlı dağıtım planına göre
              <ul className="list-disc pl-5 space-y-1">
                <li>Sanatçı</li>
                <li>Organizatör</li>
                <li>Mekân</li>
                <li>Platform</li>
                <li>(Varsa) yönlendirme paylarını</li>
              </ul>
            </li>
            <li>Aynı işlem içinde otomatik olarak dağıtır</li>
          </ul>
          <p>Dağıtım oranlarının toplamı %100 olacak şekilde kilitlenir.
            Bu şart sağlanmadan ödeme süreci başlatılmaz.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Dağıtım planı ve paydaş tanımlama</h2>
          <p>Dağıtım planları akıllı sözleşmede saklanır.
            Sonradan değişiklik yapmak için yetkili yönetici onayı ve zincir üstü işlem gerekir.</p>
          <p>Paydaşlar, ENS etiketleriyle tanımlanır.
            ENS kullanımı, karmaşık adresler yerine okunabilir isimler sunarak işlem hatalarını azaltır.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">NFT tabanlı biletler</h2>
          <p>Bu platformda biletler yalnızca bir erişim belgesi değil,
            dijital bir varlık olarak tasarlanır.</p>
          <p>Her bilet, sanat severin cüzdanında saklanan benzersiz bir dijital bilete dönüşebilir.
            Bu yaklaşım:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Sahipliği kanıtlanabilir hale getirir</li>
            <li>Sahte bilet riskini ortadan kaldırır</li>
            <li>Hatıra değeri taşıyan koleksiyonel biletler oluşturur</li>
          </ul>
          <p>NFT altyapısı, sanat severler için özel deneyimlerin ve gelecekteki avantajların temelini oluşturur.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Şeffaflık ve güven</h2>
          <p>Tüm işlemler zincir üstü olduğu için:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Ne zaman ödeme yapıldı?</li>
            <li>Ne kadar dağıtıldı?</li>
            <li>Hangi adrese gitti?</li>
          </ul>
          <p>Bu soruların tamamı herkes tarafından doğrulanabilir.</p>
          <p>Bu, bir vaatten çok daha fazlasıdır.
            Bu, teknik olarak kanıtlanabilir bir güvendir.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Güvenlik yaklaşımı</h2>
          <p>Platform tasarımında şu ilkeler benimsenmiştir:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Yeniden giriş saldırılarına karşı koruma</li>
            <li>Dağıtım kurallarının kontrollü yönetimi</li>
            <li>Yanlış ağ üzerinde işlem engeli</li>
            <li>İşlem ücreti ve toplam maliyetin kullanıcıya açık gösterimi</li>
            <li>Acil durumlarda işlem açma ve kapama mekanizması</li>
          </ul>
          <p>Amaç:
            Kullanıcıyı değil, sistemi korumak.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Vizyon ve gelecek</h2>
          <p>Etkinlik &amp; Konser, kısa vadeli bir bilet platformu değildir.</p>
          <p>Uzun vadeli hedef:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Etkinlik ekonomisinde adil ödeme standardı olmak</li>
            <li>Sanatçıların ve organizatörlerin güvenle çalıştığı bir altyapı sunmak</li>
            <li>Sanat severlere, destek oldukları etkinliklerin arkasındaki sistemi göstermek</li>
          </ul>
          <p>Bu platform, bugünün değil;
            önümüzdeki 10 yılın etkinlik altyapısını inşa eder.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4 text-white/80">
          <h2 className="text-2xl font-semibold">Son söz</h2>
          <p>Bu white paper’ı okuyan herkes için mesaj nettir:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Sanat sever için → bilinçli ve özel bir deneyim</li>
            <li>Sanatçı için → adil ve şeffaf bir sistem</li>
            <li>Organizasyonlar için → güvenilir bir altyapı</li>
            <li>Gelecek için → merkeziyetsiz ama sade bir vizyon</li>
          </ul>
          <p>Güven, bir vaatten değil;
            herkesin doğrulayabildiği sistemlerden doğar.</p>
        </section>
      </div>
    </main>
  );
}
