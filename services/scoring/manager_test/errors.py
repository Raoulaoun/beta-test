"""Statement errors. Each carries a stable code; the user-facing message comes from
docs/advice-texts.md ("Upload errors and result notes"), word for word.
"""


class StatementError(Exception):
    code = "not_a_report"
    doc_case = "Not a report"

    def __init__(self, detail: str | None = None):
        super().__init__(detail or self.code)
        self.detail = detail

    @property
    def message(self) -> str:
        from . import texts
        return texts.load()["messages"][self.doc_case]


class FileTooLarge(StatementError):
    code = "file_too_large"
    doc_case = "File too large"


class NotAReport(StatementError):
    code = "not_a_report"
    doc_case = "Not a report"


class EmptyReport(StatementError):
    code = "empty_report"
    doc_case = "Empty report"
