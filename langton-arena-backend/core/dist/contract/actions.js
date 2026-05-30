// core/src/contract/actions.ts
//
// Контракт интерфейса — типы actions.
// Соответствие: docs/interface-contract.md §5.
//
// UI вызывает actions через callback. Каждое действие возвращает Promise<ActionResult>.
// Сервер обрабатывает асинхронно.
/**
 * No-op actions для тестирования и preview.
 * Возвращает каждое действие как `Promise<{ success: true }>` без побочных эффектов.
 *
 * UI должен корректно рендерить с noopActions() для design-canvas и storybook.
 */
export function noopActions() {
    const noop = async () => ({ success: true });
    return new Proxy({}, {
        get: () => noop,
    });
}
//# sourceMappingURL=actions.js.map