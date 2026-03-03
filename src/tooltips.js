var TIPS = {
  contactados: {
    title: "Leads Contactados",
    description: "Total de leads que recibieron al menos el primer mensaje (MSG1) de Yago.",
    formula: "COUNT(threads con MSG1 enviado)",
    why: "Base del embudo. Indica el volumen de alcance del SDR automatizado.",
    source: "PostHog \u2014 eventos de template enviado"
  },
  respuestaRate: {
    title: "Tasa de Respuesta",
    description: "Porcentaje de leads contactados que enviaron al menos un mensaje de respuesta.",
    formula: "(leads que respondieron / contactados) \u00D7 100",
    why: "M\u00E9trica core de efectividad. Un WA warm benchmark es 40-60%.",
    source: "PostHog \u2014 mensajes humanos (role=1)"
  },
  respuestaReales: {
    title: "Respuestas Reales",
    description: "Respuestas excluyendo auto-replies. Se detectan ~30 patrones en ES/PT/EN (ej: 'fuera de oficina', 'n\u00E3o estou').",
    formula: "respondieron - auto_replies",
    why: "Evita inflar m\u00E9tricas con respuestas autom\u00E1ticas que no representan inter\u00E9s real.",
    source: "Detecci\u00F3n heur\u00EDstica de auto-replies"
  },
  instagram: {
    title: "Env\u00EDo de Instagram",
    description: "Leads que compartieron su perfil de Instagram durante la conversaci\u00F3n.",
    formula: "regex: instagram.com + @usuario en mensajes del lead",
    why: "Indicador de inter\u00E9s: el lead comparte un canal personal, avanzando la relaci\u00F3n.",
    source: "PostHog \u2014 contenido de mensajes humanos"
  },
  configPlataforma: {
    title: "Configuraci\u00F3n de Plataforma",
    description: "Leads cuya conversaci\u00F3n incluy\u00F3 el uso de herramientas (tool_use) por parte de Yago.",
    formula: "COUNT(threads con message_type = 'tool')",
    why: "Indica que Yago realiz\u00F3 una acci\u00F3n concreta (configurar, buscar info, etc.).",
    source: "PostHog \u2014 message_type = tool"
  },
  ofertaReunion: {
    title: "Oferta de Reuni\u00F3n",
    description: "Leads que recibieron un link de meetings.hubspot.com durante la conversaci\u00F3n.",
    formula: "COUNT(threads con meetings.hubspot.com/ en mensaje de Yago)",
    why: "Paso final del embudo outbound. Mide conversi\u00F3n a oportunidad de venta.",
    source: "PostHog \u2014 contenido de mensajes de Yago"
  },
  funnel: {
    title: "Embudo de Conversi\u00F3n",
    description: "Visualiza la ca\u00EDda progresiva desde el primer contacto hasta la oferta de reuni\u00F3n.",
    formula: "% del paso anterior = (valor paso N / valor paso N-1) \u00D7 100",
    why: "Identifica d\u00F3nde se pierden m\u00E1s leads para optimizar esos pasos.",
    source: "PostHog \u2014 embudo calculado"
  },
  yagoVsMercado: {
    title: "Yago vs Mercado",
    description: "Compara las tasas de Yago con benchmarks p\u00FAblicos de la industria.",
    formula: "Benchmarks de Twilio, Meta Business, Respond.io, ChatArchitect (2024-2025)",
    why: "Contextualiza el rendimiento de Yago frente a est\u00E1ndares del mercado.",
    source: "Reportes p\u00FAblicos Twilio / Meta / Respond.io"
  },
  esVsPt: {
    title: "Espa\u00F1ol vs Portugu\u00E9s",
    description: "Compara tasa de respuesta entre templates en espa\u00F1ol (LATAM) y portugu\u00E9s (Brasil).",
    formula: "tasa por idioma = (resp_idioma / enviados_idioma) \u00D7 100",
    why: "Detecta diferencias de rendimiento por mercado/idioma para ajustar copy.",
    source: "PostHog \u2014 idioma del template"
  },
  leadsPorDia: {
    title: "Leads por D\u00EDa",
    description: "Cantidad de leads contactados (MSG1) por d\u00EDa en el per\u00EDodo seleccionado.",
    formula: "COUNT por fecha de template_sent_at",
    why: "Muestra la cadencia de env\u00EDo y detecta picos o ca\u00EDdas en el volumen.",
    source: "PostHog \u2014 template_sent_at"
  },
  engagementDistribucion: {
    title: "Distribuci\u00F3n de Engagement",
    description: "Clasifica leads seg\u00FAn su nivel de interacci\u00F3n con Yago.",
    formula: "Alto: lead_qualification='Alta' | Medio: 'Media' | Bajo: 'Baja' | M\u00EDnimo: sin calificaci\u00F3n o 1 msg",
    why: "Identifica qu\u00E9 proporci\u00F3n de leads tiene conversaciones significativas.",
    source: "PostHog \u2014 lead_qualification + conteo de mensajes"
  },
  autoReply: {
    title: "Auto-Replies",
    description: "Respuestas autom\u00E1ticas detectadas por ~30 patrones en ES/PT/EN.",
    formula: "Detecci\u00F3n: 'fuera de oficina', 'out of office', 'n\u00E3o estou', 'automatic reply', etc.",
    why: "Inflan las m\u00E9tricas de respuesta. Filtrarlas da una visi\u00F3n m\u00E1s realista.",
    source: "An\u00E1lisis heur\u00EDstico del primer mensaje del lead"
  },
  temasAbordados: {
    title: "Temas Abordados",
    description: "T\u00F3picos m\u00E1s frecuentes en las conversaciones, detectados por keywords.",
    formula: "Match de keywords por t\u00F3pico (automatizaci\u00F3n, whatsapp, soporte, precios, etc.)",
    why: "Revela qu\u00E9 buscan los leads y d\u00F3nde est\u00E1 el mayor inter\u00E9s.",
    source: "PostHog \u2014 contenido de conversaciones"
  },
  horarioRespuestas: {
    title: "Horario de Respuestas",
    description: "Distribuci\u00F3n por hora del d\u00EDa de los mensajes recibidos.",
    formula: "COUNT agrupado por hora de message_datetime",
    why: "Optimizar env\u00EDos en horarios pico mejora tasa de respuesta.",
    source: "PostHog \u2014 message_datetime"
  },
  profundidadConversacion: {
    title: "Profundidad de Conversaci\u00F3n",
    description: "Clasifica conversaciones por cantidad de mensajes intercambiados.",
    formula: "Rebote: 1 msg | Corta: 2-4 | Media: 5-9 | Profunda: 10+",
    why: "Conversaciones m\u00E1s profundas correlacionan con mayor inter\u00E9s y conversi\u00F3n.",
    source: "PostHog \u2014 conteo de mensajes por thread"
  },
  leadsRecurrentes: {
    title: "Leads Recurrentes",
    description: "Leads que enviaron mensajes en m\u00E1s de un d\u00EDa distinto.",
    formula: "COUNT(leads con d\u00EDas \u00FAnicos de mensajes > 1)",
    why: "Indica inter\u00E9s persistente: el lead vuelve a buscar informaci\u00F3n.",
    source: "PostHog \u2014 fechas de mensajes por lead"
  },
  conResultado: {
    title: "Con Resultado",
    description: "Leads cuya conversaci\u00F3n tuvo un outcome concreto.",
    formula: "hasTool OR hasInstagramLink OR hasMeetingLink",
    why: "Mide la efectividad de la conversaci\u00F3n en generar una acci\u00F3n tangible.",
    source: "PostHog \u2014 an\u00E1lisis de contenido"
  },
  conversionSignup: {
    title: "Conversi\u00F3n a Signup",
    description: "Leads que recibieron link de crear cuenta (yavendio.com) y avanzaron al Step 1.",
    formula: "regex yavendio.com en mensajes + match con lifecycle_phones",
    why: "M\u00E9trica de conversi\u00F3n final: del chat al registro en plataforma.",
    source: "PostHog + lifecycle_phones de Metabase"
  },
  jornadaConversionInbound: {
    title: "Jornada de Conversi\u00F3n Inbound",
    description: "Embudo de 4 pasos: Lead \u2192 Engajaron \u2192 Link Cuenta \u2192 Step 1.",
    formula: "% entre cada paso = (paso N / paso N-1) \u00D7 100",
    why: "Visualiza d\u00F3nde se pierden leads inbound en el proceso de conversi\u00F3n.",
    source: "PostHog \u2014 embudo inbound calculado"
  },
  outcomePorTopico: {
    title: "Outcomes por T\u00F3pico",
    description: "Cruza temas de conversaci\u00F3n con resultados obtenidos.",
    formula: "Para cada t\u00F3pico: % con resultado = (con outcome / total t\u00F3pico) \u00D7 100",
    why: "Identifica qu\u00E9 temas generan m\u00E1s acciones concretas.",
    source: "PostHog \u2014 cruce temas \u00D7 outcomes"
  },
  templatePerformance: {
    title: "Performance de Templates",
    description: "Tasa de respuesta de cada template individual.",
    formula: "resp/sent \u00D7 100 | Verde: \u226520% | Amarillo: \u226512% | Rojo: <12%",
    why: "Permite identificar y escalar los templates m\u00E1s efectivos.",
    source: "PostHog \u2014 template_sent + respuestas"
  },
  cadencia: {
    title: "Cadencia de Mensajes",
    description: "Secuencia temporal de templates: D+0, D+1, D+3, D+5.",
    formula: "D+0: Contacto inicial | D+1: Seguimiento | D+3: Value Nudge | D+5: Quick Audit",
    why: "La cadencia define el ritmo de contacto. Espaciar bien evita ser invasivo.",
    source: "Configuraci\u00F3n de templates"
  },
  meetByTemplate: {
    title: "Template de 1a Respuesta (Reuniones)",
    description: "\u00BFEn qu\u00E9 template respondieron por primera vez los leads que llegaron a reuni\u00F3n?",
    formula: "\u00DAltimo template antes del 1er mensaje humano",
    why: "Revela qu\u00E9 templates son m\u00E1s efectivos para generar reuniones.",
    source: "PostHog \u2014 secuencia template \u2192 respuesta"
  },
  benchmarkComparacion: {
    title: "Comparaci\u00F3n con Benchmarks",
    description: "Compara m\u00E9tricas de Yago con benchmarks de la industria para warm leads.",
    formula: "\u0394 = valor Yago - valor benchmark",
    why: "Contextualiza si el rendimiento est\u00E1 por arriba o debajo del est\u00E1ndar.",
    source: "Twilio, Meta, Respond.io, ChatArchitect (2024-2025)"
  },
  veredicto: {
    title: "Veredicto y Acciones",
    description: "Resumen ejecutivo con fortalezas, gaps identificados y acciones recomendadas.",
    formula: "An\u00E1lisis cualitativo basado en todas las m\u00E9tricas anteriores",
    why: "Traduce los datos en decisiones accionables para el equipo.",
    source: "An\u00E1lisis consolidado del dashboard"
  }
};

export default TIPS;
