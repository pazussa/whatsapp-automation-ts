Feature: Crear cultivos 

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Crear cultivo por flujo de preguntas
    When inicio el flujo de creación de cultivo
    And respondo con el nombre, variedad y destino
    Then el bot confirma la creación
