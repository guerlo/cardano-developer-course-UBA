#import "@preview/touying:0.6.1": *
#import "../theme/theme.typ": *
#import "@preview/gentle-clues:1.2.0": *
#import "@preview/pinit:0.2.2": *
#import "../templates/diagrams.typ": transaction_diagram, utxo_info
#import "../components/splitted.typ": *



#show: custom-theme.with(aspect-ratio: "16-9", is-dark-mode: false)
#set text(lang: "es")

// Custom title slide
#title-slide(
  title: [Oracle],
  author: [Robertino Martinez],
  is-dark-mode: true,
  date: datetime.today(),
)

#focus-slide2([¿Qué es un Oracle?], 1)

= Oracle

== ¿Qué es un Oracle?

Un oracle es un servicio que proporciona *datos del mundo real* a los validadores:

#pause
- Precios de activos
#pause
- Condiciones climáticas
#pause
- Eventos deportivos
#pause
- ...

#v(1em)
#pause
Son necesarios porque una Blockchain es un *sistema cerrado* que interactúa solamente con los datos del mismo sistema.

#v(1em)
#pause
El diseño de algunos protocolos es *imposible* sin usar datos de fuera de la blockchain.


== Desplegar Oracle

#image("../images/deploy_oracle.png", width: 100%, fit: "cover")

== Actualizar Oracle

#image("../images/update_oracle.png", width: 100%)

== Eliminar Oracle

#image("../images/delete_oracle.png", width: 100%)

== Consultar Oracle

#image("../images/use_oracle.png", width: 100%)
