import { useEffect } from "react";

/**
 * A landing de social media virou página estática em /unvsocial — ela abre
 * instantânea porque é servida direto pelo Worker, fora do bundle do app.
 *
 * O redirecionamento principal acontece no script inline do index.html (antes do
 * bundle carregar). Este componente só cobre a navegação interna do SPA, quando
 * alguém cai em /#/social-media com o app já em memória.
 */
const SocialMediaPage = () => {
  useEffect(() => {
    const hash = window.location.hash || "";
    const iq = hash.indexOf("?");
    let qs = window.location.search || "";
    if (iq > -1) qs = qs ? `${qs}&${hash.slice(iq + 1)}` : `?${hash.slice(iq + 1)}`;
    window.location.replace(`/unvsocial/${qs}`);
  }, []);

  return null;
};

export default SocialMediaPage;
